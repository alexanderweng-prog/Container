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
