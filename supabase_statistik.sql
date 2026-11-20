-- Lernwerkstatt: anonyme Statistik pro Frage (in Supabase im SQL Editor ausführen).
-- Wird für die Auswertung gebraucht. Im Projekt «Leistungs App» ist das bereits eingerichtet.
create table if not exists public.lw_statistik (
  paket_id     text not null check (length(paket_id) between 1 and 64),
  karte_id     text not null check (length(karte_id) between 1 and 40),
  paket_titel  text not null default '' check (length(paket_titel) <= 200),
  frage        text not null default '' check (length(frage) <= 400),
  art          text not null default '' check (length(art) <= 20),
  richtig      integer not null default 0 check (richtig >= 0),
  falsch       integer not null default 0 check (falsch >= 0),
  wiederholt   integer not null default 0 check (wiederholt >= 0),
  aktualisiert timestamptz not null default now(),
  primary key (paket_id, karte_id)
);
alter table public.lw_statistik enable row level security;
drop policy if exists "lw_statistik lesen" on public.lw_statistik;
create policy "lw_statistik lesen" on public.lw_statistik for select to anon, authenticated using (true);

create or replace function public.lw_statistik_melden(
  p_paket text, p_titel text, p_karte text, p_frage text, p_art text, p_richtig boolean, p_wiederholung boolean
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_paket is null or p_karte is null or length(p_paket) not between 1 and 64 or length(p_karte) not between 1 and 40 or p_richtig is null then
    raise exception 'ungültige Meldung';
  end if;
  insert into public.lw_statistik as s (paket_id, karte_id, paket_titel, frage, art, richtig, falsch, wiederholt)
  values (p_paket, p_karte, left(coalesce(p_titel, ''), 200), left(coalesce(p_frage, ''), 400), left(coalesce(p_art, ''), 20),
          case when p_richtig then 1 else 0 end, case when p_richtig then 0 else 1 end, case when coalesce(p_wiederholung, false) then 1 else 0 end)
  on conflict (paket_id, karte_id) do update set
    richtig = s.richtig + excluded.richtig, falsch = s.falsch + excluded.falsch, wiederholt = s.wiederholt + excluded.wiederholt,
    paket_titel = excluded.paket_titel, frage = excluded.frage, art = excluded.art, aktualisiert = now();
end; $$;
revoke all on function public.lw_statistik_melden(text, text, text, text, text, boolean, boolean) from public;
grant execute on function public.lw_statistik_melden(text, text, text, text, text, boolean, boolean) to anon, authenticated;
grant select on public.lw_statistik to anon, authenticated;
revoke insert, update, delete on public.lw_statistik from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Kurzlinks: geteilte Pakete unter 7-stelligem Code (nur über die Funktionen zugänglich)
create table if not exists public.lw_pakete (
  code text primary key check (code ~ '^[a-z2-9]{7}$'),
  titel text not null default '' check (length(titel) <= 200),
  daten jsonb not null,
  token_hash text not null,
  erstellt timestamptz not null default now(),
  aktualisiert timestamptz not null default now(),
  abrufe integer not null default 0
);
alter table public.lw_pakete enable row level security;
revoke all on public.lw_pakete from anon, authenticated;

create or replace function public.lw_paket_teilen(p_daten jsonb, p_titel text, p_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789'; v_code text; v_bytes bytea; i int;
begin
  if p_daten is null or jsonb_typeof(p_daten) not in ('object', 'array') then raise exception 'ungültiges Paket'; end if;
  if octet_length(p_daten::text) > 1500000 then raise exception 'Paket zu gross'; end if;
  if p_token is null or length(p_token) not between 24 and 100 then raise exception 'ungültiger Schlüssel'; end if;
  for versuch in 1..10 loop
    v_bytes := extensions.gen_random_bytes(7); v_code := '';
    for i in 0..6 loop v_code := v_code || substr(alphabet, (get_byte(v_bytes, i) % length(alphabet)) + 1, 1); end loop;
    begin
      insert into public.lw_pakete (code, titel, daten, token_hash)
      values (v_code, left(coalesce(p_titel, ''), 200), p_daten, encode(extensions.digest(p_token, 'sha256'), 'hex'));
      return v_code;
    exception when unique_violation then end;
  end loop;
  raise exception 'Kein freier Code gefunden';
end; $$;

create or replace function public.lw_paket_aktualisieren(p_code text, p_daten jsonb, p_titel text, p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_anzahl int;
begin
  if p_daten is null or jsonb_typeof(p_daten) not in ('object', 'array') then raise exception 'ungültiges Paket'; end if;
  if octet_length(p_daten::text) > 1500000 then raise exception 'Paket zu gross'; end if;
  update public.lw_pakete set daten = p_daten, titel = left(coalesce(p_titel, ''), 200), aktualisiert = now()
   where code = p_code and token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  get diagnostics v_anzahl = row_count;
  return v_anzahl = 1;
end; $$;

create or replace function public.lw_paket_laden(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_daten jsonb;
begin
  update public.lw_pakete set abrufe = abrufe + 1 where code = lower(p_code) returning daten into v_daten;
  return v_daten;
end; $$;

revoke all on function public.lw_paket_teilen(jsonb, text, text) from public;
revoke all on function public.lw_paket_aktualisieren(text, jsonb, text, text) from public;
revoke all on function public.lw_paket_laden(text) from public;
grant execute on function public.lw_paket_teilen(jsonb, text, text) to anon, authenticated;
grant execute on function public.lw_paket_aktualisieren(text, jsonb, text, text) to anon, authenticated;
grant execute on function public.lw_paket_laden(text) to anon, authenticated;

-- ============================================================
-- Klassen: ein Kurzlink pro Klasse, Auswertung pro Klasse, «Meine Kurzlinks»
-- (Migration «lernwerkstatt_klassen»)
-- ============================================================

-- Statistik zusätzlich nach Kurzlink getrennt ('' = ohne Kurzlink)
alter table public.lw_statistik add column if not exists kurz text not null default '';
alter table public.lw_statistik add constraint lw_statistik_kurz_check check (kurz = '' or kurz ~ '^[a-z2-9]{7}$');
alter table public.lw_statistik drop constraint lw_statistik_pkey;
alter table public.lw_statistik add primary key (paket_id, karte_id, kurz);

drop function if exists public.lw_statistik_melden(text, text, text, text, text, boolean, boolean);
create function public.lw_statistik_melden(p_paket text, p_titel text, p_karte text, p_frage text, p_art text,
  p_richtig boolean, p_wiederholung boolean, p_kurz text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare v_kurz text := lower(coalesce(p_kurz, ''));
begin
  if p_paket is null or p_karte is null or length(p_paket) not between 1 and 64 or length(p_karte) not between 1 and 40 or p_richtig is null then
    raise exception 'ungültige Meldung';
  end if;
  if v_kurz <> '' and v_kurz !~ '^[a-z2-9]{7}$' then v_kurz := ''; end if;
  insert into public.lw_statistik as s (paket_id, karte_id, kurz, paket_titel, frage, art, richtig, falsch, wiederholt)
  values (
    p_paket, p_karte, v_kurz,
    left(coalesce(p_titel, ''), 200), left(coalesce(p_frage, ''), 400), left(coalesce(p_art, ''), 20),
    case when p_richtig then 1 else 0 end,
    case when p_richtig then 0 else 1 end,
    case when coalesce(p_wiederholung, false) then 1 else 0 end
  )
  on conflict (paket_id, karte_id, kurz) do update set
    richtig      = s.richtig + excluded.richtig,
    falsch       = s.falsch + excluded.falsch,
    wiederholt   = s.wiederholt + excluded.wiederholt,
    paket_titel  = excluded.paket_titel,
    frage        = excluded.frage,
    art          = excluded.art,
    aktualisiert = now();
end; $$;

-- Kurzlinks bekommen einen Klassennamen (z. B. «1a»)
alter table public.lw_pakete add column if not exists klasse text not null default '';
alter table public.lw_pakete add constraint lw_pakete_klasse_check check (length(klasse) <= 60);

drop function if exists public.lw_paket_teilen(jsonb, text, text);
create function public.lw_paket_teilen(p_daten jsonb, p_titel text, p_token text, p_klasse text default '')
returns text language plpgsql security definer set search_path = '' as $$
declare alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789'; v_code text; v_bytes bytea; i int;
begin
  if p_daten is null or jsonb_typeof(p_daten) not in ('object', 'array') then raise exception 'ungültiges Paket'; end if;
  if octet_length(p_daten::text) > 1500000 then raise exception 'Paket zu gross'; end if;
  if p_token is null or length(p_token) not between 24 and 100 then raise exception 'ungültiger Schlüssel'; end if;
  for versuch in 1..10 loop
    v_bytes := extensions.gen_random_bytes(7); v_code := '';
    for i in 0..6 loop v_code := v_code || substr(alphabet, (get_byte(v_bytes, i) % length(alphabet)) + 1, 1); end loop;
    begin
      insert into public.lw_pakete (code, titel, klasse, daten, token_hash)
      values (v_code, left(coalesce(p_titel, ''), 200), left(trim(coalesce(p_klasse, '')), 60), p_daten, encode(extensions.digest(p_token, 'sha256'), 'hex'));
      return v_code;
    exception when unique_violation then end;
  end loop;
  raise exception 'Kein freier Code gefunden';
end; $$;

-- p_daten null = Inhalt behalten (nur Klasse umbenennen); p_klasse null = Klasse behalten
drop function if exists public.lw_paket_aktualisieren(text, jsonb, text, text);
create function public.lw_paket_aktualisieren(p_code text, p_daten jsonb, p_titel text, p_token text, p_klasse text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_anzahl int;
begin
  if p_daten is not null and jsonb_typeof(p_daten) not in ('object', 'array') then raise exception 'ungültiges Paket'; end if;
  if octet_length(coalesce(p_daten::text, '')) > 1500000 then raise exception 'Paket zu gross'; end if;
  update public.lw_pakete set
      daten = coalesce(p_daten, daten),
      titel = case when p_daten is null then titel else left(coalesce(p_titel, ''), 200) end,
      klasse = coalesce(left(trim(p_klasse), 60), klasse),
      aktualisiert = now()
   where code = p_code and token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  get diagnostics v_anzahl = row_count;
  return v_anzahl = 1;
end; $$;

-- Löschen nur mit Bearbeitungsschlüssel; die gezählten Antworten bleiben
create or replace function public.lw_paket_loeschen(p_code text, p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_anzahl int;
begin
  delete from public.lw_pakete where code = p_code and token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  get diagnostics v_anzahl = row_count;
  return v_anzahl = 1;
end; $$;

-- Angaben zu bekannten Codes (keine Liste aller Codes, kein Inhalt)
create or replace function public.lw_kurzlinks_info(p_codes text[])
returns table (code text, titel text, klasse text, abrufe int, erstellt timestamptz, aktualisiert timestamptz)
language sql security definer set search_path = '' stable as $$
  select k.code, k.titel, k.klasse, k.abrufe, k.erstellt, k.aktualisiert
    from public.lw_pakete k
   where k.code = any (p_codes[1:300]);
$$;

revoke all on function public.lw_statistik_melden(text, text, text, text, text, boolean, boolean, text) from public;
revoke all on function public.lw_paket_teilen(jsonb, text, text, text) from public;
revoke all on function public.lw_paket_aktualisieren(text, jsonb, text, text, text) from public;
revoke all on function public.lw_paket_loeschen(text, text) from public;
revoke all on function public.lw_kurzlinks_info(text[]) from public;
grant execute on function public.lw_statistik_melden(text, text, text, text, text, boolean, boolean, text) to anon, authenticated;
grant execute on function public.lw_paket_teilen(jsonb, text, text, text) to anon, authenticated;
grant execute on function public.lw_paket_aktualisieren(text, jsonb, text, text, text) to anon, authenticated;
grant execute on function public.lw_paket_loeschen(text, text) to anon, authenticated;
grant execute on function public.lw_kurzlinks_info(text[]) to anon, authenticated;

-- ============================================================
-- Erster Versuch, gewählte falsche Antworten, Sicherheit (Migration «lernwerkstatt_erst_antworten»)
-- ============================================================
alter table public.lw_statistik
  add column if not exists erst_richtig integer not null default 0 check (erst_richtig >= 0),
  add column if not exists erst_falsch integer not null default 0 check (erst_falsch >= 0),
  add column if not exists sicher_falsch integer not null default 0 check (sicher_falsch >= 0),
  add column if not exists erst_sicher_falsch integer not null default 0 check (erst_sicher_falsch >= 0),
  add column if not exists geraten_richtig integer not null default 0 check (geraten_richtig >= 0),
  add column if not exists erst_geraten_richtig integer not null default 0 check (erst_geraten_richtig >= 0);

-- Gewählte falsche Antworten. Nicht direkt lesbar: freie Eingaben (Lückentext, Fachbegriff) erscheinen
-- erst ab 3 gleichen Antworten, damit keine Namen oder Einzelbemerkungen öffentlich sichtbar werden.
create table if not exists public.lw_antworten (
  paket_id text not null,
  karte_id text not null,
  kurz text not null default '',
  art text not null default '' check (length(art) <= 20),
  antwort text not null check (length(antwort) between 1 and 80),
  anzahl integer not null default 0 check (anzahl >= 0),
  erst_anzahl integer not null default 0 check (erst_anzahl >= 0),
  aktualisiert timestamptz not null default now(),
  primary key (paket_id, karte_id, kurz, antwort)
);
alter table public.lw_antworten enable row level security;
revoke all on public.lw_antworten from anon, authenticated;

drop function if exists public.lw_statistik_melden(text, text, text, text, text, boolean, boolean, text);
create function public.lw_statistik_melden(p_paket text, p_titel text, p_karte text, p_frage text, p_art text,
  p_richtig boolean, p_wiederholung boolean, p_kurz text default '', p_erst boolean default false,
  p_sicherheit text default '', p_antwort text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_kurz text := lower(coalesce(p_kurz, ''));
  v_erst boolean := coalesce(p_erst, false);
  v_sicher boolean := coalesce(p_sicherheit, '') = 'sicher';
  v_geraten boolean := coalesce(p_sicherheit, '') in ('unsicher', 'geraten');
  v_antwort text := left(regexp_replace(trim(coalesce(p_antwort, '')), '\s+', ' ', 'g'), 80);
begin
  if p_paket is null or p_karte is null or length(p_paket) not between 1 and 64 or length(p_karte) not between 1 and 40 or p_richtig is null then
    raise exception 'ungültige Meldung';
  end if;
  if v_kurz <> '' and v_kurz !~ '^[a-z2-9]{7}$' then v_kurz := ''; end if;
  insert into public.lw_statistik as s (paket_id, karte_id, kurz, paket_titel, frage, art, richtig, falsch, wiederholt,
      erst_richtig, erst_falsch, sicher_falsch, erst_sicher_falsch, geraten_richtig, erst_geraten_richtig)
  values (
    p_paket, p_karte, v_kurz,
    left(coalesce(p_titel, ''), 200), left(coalesce(p_frage, ''), 400), left(coalesce(p_art, ''), 20),
    (p_richtig)::int, (not p_richtig)::int, coalesce(p_wiederholung, false)::int,
    (v_erst and p_richtig)::int, (v_erst and not p_richtig)::int,
    (v_sicher and not p_richtig)::int, (v_erst and v_sicher and not p_richtig)::int,
    (v_geraten and p_richtig)::int, (v_erst and v_geraten and p_richtig)::int
  )
  on conflict (paket_id, karte_id, kurz) do update set
    richtig = s.richtig + excluded.richtig,
    falsch = s.falsch + excluded.falsch,
    wiederholt = s.wiederholt + excluded.wiederholt,
    erst_richtig = s.erst_richtig + excluded.erst_richtig,
    erst_falsch = s.erst_falsch + excluded.erst_falsch,
    sicher_falsch = s.sicher_falsch + excluded.sicher_falsch,
    erst_sicher_falsch = s.erst_sicher_falsch + excluded.erst_sicher_falsch,
    geraten_richtig = s.geraten_richtig + excluded.geraten_richtig,
    erst_geraten_richtig = s.erst_geraten_richtig + excluded.erst_geraten_richtig,
    paket_titel = excluded.paket_titel,
    frage = excluded.frage,
    art = excluded.art,
    aktualisiert = now();

  if not p_richtig and v_antwort <> '' then
    insert into public.lw_antworten as a (paket_id, karte_id, kurz, art, antwort, anzahl, erst_anzahl)
    values (p_paket, p_karte, v_kurz, left(coalesce(p_art, ''), 20), v_antwort, 1, v_erst::int)
    on conflict (paket_id, karte_id, kurz, antwort) do update set
      anzahl = a.anzahl + 1, erst_anzahl = a.erst_anzahl + excluded.erst_anzahl, aktualisiert = now();
  end if;
end; $$;

-- Falsche Antworten für die Auswertung: Auswahl-Antworten (mc, kat) immer, freie Eingaben erst ab 3 gleichen
create or replace function public.lw_antworten_laden()
returns table (paket_id text, karte_id text, kurz text, art text, antwort text, anzahl int, erst_anzahl int)
language sql security definer set search_path = '' stable as $$
  select a.paket_id, a.karte_id, a.kurz, a.art, a.antwort, a.anzahl, a.erst_anzahl
    from public.lw_antworten a
   where a.art in ('mc', 'kap', 'kat') or a.anzahl >= 3
   order by a.anzahl desc
   limit 20000;
$$;

revoke all on function public.lw_statistik_melden(text, text, text, text, text, boolean, boolean, text, boolean, text, text) from public;
revoke all on function public.lw_antworten_laden() from public;
grant execute on function public.lw_statistik_melden(text, text, text, text, text, boolean, boolean, text, boolean, text, text) to anon, authenticated;
grant execute on function public.lw_antworten_laden() to anon, authenticated;

-- ============================================================
-- Plenumsmodus (Migration «lernwerkstatt_plenum»): Abstimmung im Klassenzimmer
-- Tabellen nur über Funktionen erreichbar; Sitzungen werden nach zwei Tagen gelöscht.
-- ============================================================
create table if not exists public.lw_plenum (
  code text primary key check (code ~ '^[a-z2-9]{6}$'),
  token_hash text not null,
  titel text not null default '' check (length(titel) <= 200),
  fragen jsonb not null,
  aktuell integer not null default 0,
  runde integer not null default 1 check (runde between 1 and 2),
  status text not null default 'warten' check (status in ('warten', 'offen', 'geschlossen', 'loesung')),
  erstellt timestamptz not null default now(),
  aktualisiert timestamptz not null default now()
);
create table if not exists public.lw_plenum_stimmen (
  code text not null references public.lw_plenum(code) on delete cascade,
  frage integer not null,
  runde integer not null,
  geraet text not null check (geraet ~ '^[A-Za-z0-9_-]{16,64}$'),
  wahl integer not null check (wahl between 0 and 9),
  zeit timestamptz not null default now(),
  primary key (code, frage, runde, geraet)
);
alter table public.lw_plenum enable row level security;
alter table public.lw_plenum_stimmen enable row level security;
revoke all on public.lw_plenum, public.lw_plenum_stimmen from anon, authenticated;
-- Funktionen: lw_plenum_erstellen(p_titel, p_fragen, p_token) → code
--             lw_plenum_steuern(p_code, p_token, p_aktuell, p_runde, p_status) → boolean
--             lw_plenum_zustand(p_code) → jsonb (Lösung erst bei status 'loesung')
--             lw_plenum_abstimmen(p_code, p_geraet, p_frage, p_runde, p_wahl) → boolean (nur wenn offen)
--             lw_plenum_ergebnis(p_code, p_token) → jsonb (Verteilung pro Runde, Teilnehmende)
--             lw_plenum_beenden(p_code, p_token) → boolean
-- Vollständiger Code: siehe Migration «lernwerkstatt_plenum» im Supabase-Projekt.
