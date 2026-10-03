-- Reference data needed in every environment (editable later from the admin panel)
insert into languages (code, name_en, native_name, is_rtl, is_ui_enabled) values
 ('en','English','English',false,true),('ar','Arabic','العربية',true,true),('ms','Malay','Bahasa Melayu',false,true),
 ('id','Indonesian','Bahasa Indonesia',false,false),('zh','Chinese','中文',false,false),('fr','French','Français',false,false),
 ('tr','Turkish','Türkçe',false,false),('ur','Urdu','اردو',true,false),('bn','Bengali','বাংলা',false,false)
on conflict do nothing;

insert into school_types (code, name_i18n, sort_order) values
 ('day_school','{"en":"Day school","ar":"مدرسة نهارية","ms":"Sekolah harian"}',1),
 ('international_school','{"en":"International school","ar":"مدرسة دولية","ms":"Sekolah antarabangsa"}',2),
 ('tahfiz','{"en":"Tahfiz school","ar":"مدرسة تحفيظ","ms":"Sekolah tahfiz"}',3),
 ('madrasah','{"en":"Madrasah","ar":"مدرسة دينية","ms":"Madrasah"}',4),
 ('kindergarten','{"en":"Kindergarten","ar":"روضة","ms":"Tadika"}',5);
insert into curricula (code, name_i18n, sort_order) values
 ('british','{"en":"British","ar":"المنهج البريطاني","ms":"Kurikulum British"}',1),
 ('cambridge_igcse','{"en":"Cambridge IGCSE","ar":"كامبريدج IGCSE","ms":"Cambridge IGCSE"}',2),
 ('american','{"en":"American","ar":"المنهج الأمريكي","ms":"Kurikulum Amerika"}',3),
 ('ib','{"en":"International Baccalaureate","ar":"البكالوريا الدولية","ms":"Baccalaureate Antarabangsa"}',4),
 ('malaysian_national','{"en":"Malaysian national","ar":"المنهج الماليزي","ms":"Kurikulum Kebangsaan"}',5),
 ('saudi_national','{"en":"Saudi national","ar":"المنهج السعودي","ms":"Kurikulum Saudi"}',6),
 ('indonesian_national','{"en":"Indonesian national","ar":"المنهج الإندونيسي","ms":"Kurikulum Indonesia"}',7);
insert into grade_levels (code, name_i18n, sort_order) values
 ('preschool','{"en":"Preschool","ar":"ما قبل المدرسة","ms":"Prasekolah"}',1),
 ('primary','{"en":"Primary","ar":"ابتدائي","ms":"Sekolah rendah"}',2),
 ('lower_secondary','{"en":"Lower secondary","ar":"متوسط","ms":"Menengah rendah"}',3),
 ('upper_secondary','{"en":"Upper secondary","ar":"ثانوي","ms":"Menengah atas"}',4);
insert into facilities (code, name_i18n, sort_order) values
 ('library','{"en":"Library","ar":"مكتبة","ms":"Perpustakaan"}',1),
 ('sports_field','{"en":"Sports facilities","ar":"مرافق رياضية","ms":"Kemudahan sukan"}',2),
 ('laboratory','{"en":"Science laboratory","ar":"مختبر علوم","ms":"Makmal sains"}',3),
 ('computer_lab','{"en":"Computer lab","ar":"مختبر حاسوب","ms":"Makmal komputer"}',4),
 ('prayer_hall','{"en":"Prayer hall / mosque","ar":"مصلى / مسجد","ms":"Surau / masjid"}',5),
 ('cafeteria','{"en":"Cafeteria","ar":"كافتيريا","ms":"Kantin"}',6);
insert into accreditations (code, name_i18n, sort_order) values
 ('moe_registered','{"en":"Ministry of Education registered","ar":"مسجلة لدى وزارة التعليم","ms":"Berdaftar dengan Kementerian Pendidikan"}',1),
 ('cambridge_centre','{"en":"Cambridge International centre","ar":"مركز كامبريدج الدولي","ms":"Pusat Cambridge International"}',2),
 ('ib_world_school','{"en":"IB World School","ar":"مدرسة عالم البكالوريا الدولية","ms":"Sekolah Dunia IB"}',3);
insert into fee_categories (code, name_i18n, sort_order) values
 ('tuition','{"en":"Tuition","ar":"الرسوم الدراسية","ms":"Yuran pengajian"}',1),
 ('registration','{"en":"Registration","ar":"رسوم التسجيل","ms":"Yuran pendaftaran"}',2),
 ('transport','{"en":"Transportation","ar":"النقل","ms":"Pengangkutan"}',3),
 ('boarding','{"en":"Boarding","ar":"السكن الداخلي","ms":"Asrama"}',4),
 ('uniform_materials','{"en":"Uniform & materials","ar":"الزي والمستلزمات","ms":"Pakaian & bahan"}',5);
