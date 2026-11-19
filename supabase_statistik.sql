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
