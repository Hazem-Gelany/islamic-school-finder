-- DEVELOPMENT SEED DATA ONLY. All schools are fictional and flagged is_demo = true.
-- Remove before launch:  delete from schools where is_demo;
set search_path = public, extensions;

insert into countries (iso2, slug, name_i18n, currency_code) values
 ('MY','malaysia','{"en":"Malaysia","ar":"ماليزيا","ms":"Malaysia"}','MYR'),
 ('GB','united-kingdom','{"en":"United Kingdom","ar":"المملكة المتحدة","ms":"United Kingdom"}','GBP'),
 ('SA','saudi-arabia','{"en":"Saudi Arabia","ar":"المملكة العربية السعودية","ms":"Arab Saudi"}','SAR'),
 ('ID','indonesia','{"en":"Indonesia","ar":"إندونيسيا","ms":"Indonesia"}','IDR');

insert into cities (country_id, slug, name_i18n, location)
select co.id, v.slug, v.names::jsonb, st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography
from (values
 ('MY','kuala-lumpur','{"en":"Kuala Lumpur","ar":"كوالالمبور","ms":"Kuala Lumpur"}',3.1390,101.6869),
 ('MY','petaling-jaya','{"en":"Petaling Jaya","ar":"بيتالينغ جايا","ms":"Petaling Jaya"}',3.1073,101.6067),
 ('MY','george-town','{"en":"George Town","ar":"جورج تاون","ms":"George Town"}',5.4141,100.3288),
 ('GB','london','{"en":"London","ar":"لندن","ms":"London"}',51.5074,-0.1278),
 ('GB','birmingham','{"en":"Birmingham","ar":"برمنغهام","ms":"Birmingham"}',52.4862,-1.8904),
 ('GB','manchester','{"en":"Manchester","ar":"مانشستر","ms":"Manchester"}',53.4808,-2.2426),
 ('SA','riyadh','{"en":"Riyadh","ar":"الرياض","ms":"Riyadh"}',24.7136,46.6753),
 ('SA','jeddah','{"en":"Jeddah","ar":"جدة","ms":"Jeddah"}',21.4858,39.1925),
 ('ID','jakarta','{"en":"Jakarta","ar":"جاكرتا","ms":"Jakarta"}',-6.2088,106.8456),
 ('ID','bandung','{"en":"Bandung","ar":"باندونغ","ms":"Bandung"}',-6.9175,107.6191)
) v(iso, slug, names, lat, lng) join countries co on co.iso2 = v.iso;

insert into search_aliases (entity_type, entity_id, alias, language_code)
select 'city', id, a.alias, a.lang from cities c join (values ('kuala-lumpur','KL','en'),('kuala-lumpur','كوالالمبور','ar')) a(slug, alias, lang) on a.slug = c.slug;

create temp table seed_schools as select * from (values
 ('al-noor-international-islamic-school','MY','kuala-lumpur','mixed',3.1390,101.6869,'Al-Noor International Islamic School','مدرسة النور الإسلامية الدولية','Sekolah Islam Antarabangsa Al-Noor','school_verified',18000),
 ('darul-ilmi-boys-academy','MY','kuala-lumpur','boys',3.1570,101.7120,'Darul Ilmi Boys Academy','أكاديمية دار العلم للبنين','Akademi Lelaki Darul Ilmi','information_checked',12000),
 ('nur-hidayah-girls-school','MY','kuala-lumpur','girls',3.1200,101.6500,'Nur Hidayah Girls School','مدرسة نور الهداية للبنات','Sekolah Perempuan Nur Hidayah','community_added',9500),
 ('bayt-al-hikmah-tahfiz-centre','MY','kuala-lumpur','mixed',3.2000,101.7200,'Bayt Al-Hikmah Tahfiz Centre','مركز بيت الحكمة للتحفيظ','Pusat Tahfiz Bayt Al-Hikmah','school_managed',7000),
 ('cahaya-islamic-school','MY','petaling-jaya','mixed',3.1073,101.6067,'Cahaya Islamic School','مدرسة الضياء الإسلامية','Sekolah Islam Cahaya','information_checked',15000),
 ('penang-quran-academy','MY','george-town','mixed',5.4141,100.3288,'Penang Quran Academy','أكاديمية بينانغ للقرآن','Akademi Quran Pulau Pinang','community_added',8000),
 ('crescent-international-islamic-school','GB','london','mixed',51.5074,-0.1278,'Crescent International Islamic School','مدرسة الهلال الإسلامية الدولية','Sekolah Islam Antarabangsa Crescent','school_verified',9000),
 ('al-amanah-girls-school','GB','london','girls',51.5450,-0.0550,'Al-Amanah Girls School','مدرسة الأمانة للبنات','Sekolah Perempuan Al-Amanah','information_checked',8500),
 ('birmingham-boys-grammar','GB','birmingham','boys',52.4862,-1.8904,'Birmingham Islamic Boys Grammar','مدرسة برمنغهام الإسلامية للبنين','Tatabahasa Lelaki Islam Birmingham','community_added',7800),
 ('manchester-islamic-primary','GB','manchester','mixed',53.4808,-2.2426,'Manchester Islamic Primary','مدرسة مانشستر الإسلامية الابتدائية','Rendah Islam Manchester','school_managed',6500),
 ('riyadh-international-quran-school','SA','riyadh','boys',24.7136,46.6753,'Riyadh International Quran School','مدرسة الرياض الدولية للقرآن','Sekolah Quran Antarabangsa Riyadh','school_verified',25000),
 ('al-faisaliyah-girls-school','SA','riyadh','girls',24.6900,46.6850,'Al-Faisaliyah Girls School','مدرسة الفيصلية للبنات','Sekolah Perempuan Al-Faisaliyah','information_checked',22000),
 ('jeddah-islamic-academy','SA','jeddah','mixed',21.4858,39.1925,'Jeddah Islamic Academy','أكاديمية جدة الإسلامية','Akademi Islam Jeddah','community_added',20000),
 ('jakarta-global-islamic-school','ID','jakarta','mixed',-6.2088,106.8456,'Jakarta Global Islamic School','مدرسة جاكرتا الإسلامية العالمية','Sekolah Islam Global Jakarta','school_verified',45000000),
 ('bandung-madani-school','ID','bandung','mixed',-6.9175,107.6191,'Bandung Madani School','مدرسة مدني باندونغ','Sekolah Madani Bandung','information_checked',30000000)
) v(slug, iso, city, gender, lat, lng, en, ar, ms, verif, tuition);

insert into schools (slug, status, verification_status, verified_at, last_verified_at, verification_source, country_id, city_id, school_type_id,
  gender_policy, address, location, website, founded_year, student_capacity, has_boarding, has_transport,
  offers_quran, offers_arabic, offers_islamic_studies, scholarships_available, currency_code, is_demo)
select s.slug, 'active', s.verif::verification_status,
  case when s.verif in ('school_verified','school_managed') then now() end,
  case when s.verif <> 'community_added' then now() end,
  'Demo seed (fictional)', co.id, ci.id, st.id, s.gender::gender_policy, 'Demo address',
  st_setsrid(st_makepoint(s.lng, s.lat), 4326)::geography, 'https://example.org/' || s.slug,
  1990 + length(s.slug) % 30, 300 + (length(s.slug) % 10) * 50,
  s.slug ~ 'tahfiz|boys', s.gender = 'mixed', true, true, true, s.verif <> 'community_added', co.currency_code, true
from seed_schools s
join countries co on co.iso2 = s.iso
join cities ci on ci.country_id = co.id and ci.slug = s.city
join school_types st on st.code = case when s.slug ~ 'international|global' then 'international_school' when s.slug ~ 'tahfiz|quran' then 'tahfiz' else 'day_school' end;

insert into school_translations (school_id, language_code, name, description)
select sc.id, l.code,
  case l.code when 'en' then s.en when 'ar' then s.ar else s.ms end,
  case l.code when 'en' then 'DEMO DATA: fictional listing for development only.'
              when 'ar' then 'بيانات تجريبية: مدرسة افتراضية لأغراض التطوير فقط.'
              else 'DATA DEMO: senarai rekaan untuk pembangunan sahaja.' end
from seed_schools s join schools sc on sc.slug = s.slug and sc.is_demo
cross join (values ('en'),('ar'),('ms')) l(code);

insert into school_fees (school_id, fee_category_id, amount, currency_code, period)
select sc.id, fc.id, s.tuition, sc.currency_code, 'year'
from seed_schools s join schools sc on sc.slug = s.slug and sc.is_demo join fee_categories fc on fc.code = 'tuition';

insert into school_curricula (school_id, curriculum_id)
select sc.id, cu.id from schools sc join countries co on co.id = sc.country_id
join curricula cu on cu.code = case co.iso2 when 'MY' then 'malaysian_national' when 'GB' then 'british' when 'SA' then 'saudi_national' else 'indonesian_national' end
where sc.is_demo;
insert into school_curricula (school_id, curriculum_id)
select sc.id, cu.id from schools sc join curricula cu on cu.code = 'cambridge_igcse' where sc.is_demo and sc.slug ~ 'international|global';

insert into school_languages (school_id, language_code)
select sc.id, l.code from schools sc join countries co on co.id = sc.country_id
join languages l on l.code in ('en','ar') or (l.code = 'ms' and co.iso2 = 'MY') or (l.code = 'id' and co.iso2 = 'ID')
where sc.is_demo;

insert into school_grade_levels (school_id, grade_level_id)
select sc.id, g.id from schools sc join grade_levels g on g.code in ('primary','lower_secondary') or (g.code = 'upper_secondary' and sc.slug !~ 'primary')
where sc.is_demo;

insert into school_facilities (school_id, facility_id)
select sc.id, f.id from schools sc join facilities f on f.code in ('library','prayer_hall') or (f.code = 'sports_field' and sc.gender_policy <> 'girls') or (f.code = 'computer_lab' and sc.slug ~ 'international|global')
where sc.is_demo;

drop table seed_schools;
