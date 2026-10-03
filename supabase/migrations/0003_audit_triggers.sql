-- Field-level audit trail written by triggers, so no code path can skip it
set search_path = public, extensions;

create function private.audit_row() returns trigger language plpgsql security definer set search_path = '' as $$
declare j jsonb; o jsonb; n jsonb; k text; sid uuid; eid text;
  skip text[] := array['updated_at','updated_by','created_at','created_by','search_tsv','tuition_annual_min','tuition_annual_max'];
begin
  j := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  sid := case when tg_table_name = 'schools' then (j->>'id')::uuid else nullif(j->>'school_id','')::uuid end;
  eid := coalesce(j->>'id', j->>'school_id', j->>'user_id', j->>'code');
  if tg_op = 'INSERT' then
    insert into public.audit_log (user_id, entity_type, entity_id, school_id, action, new_value) values (auth.uid(), tg_table_name, eid, sid, 'insert', j - skip);
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (user_id, entity_type, entity_id, school_id, action, old_value) values (auth.uid(), tg_table_name, eid, sid, 'delete', j - skip);
  else
    o := to_jsonb(old); n := to_jsonb(new);
    for k in select jsonb_object_keys(n) loop
      if k <> all(skip) and n->k is distinct from o->k then
        insert into public.audit_log (user_id, entity_type, entity_id, school_id, action, field_name, old_value, new_value)
        values (auth.uid(), tg_table_name, eid, sid, 'update', k, o->k, n->k);
      end if;
    end loop;
  end if;
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['schools','school_translations','school_curricula','school_languages','school_facilities','school_grade_levels','school_accreditations','school_fees','school_media','school_claims','school_members','user_roles','countries','regions','cities','school_types','curricula','facilities','grade_levels','accreditations','fee_categories'] loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function private.audit_row()', t);
  end loop;
end $$;

-- Belt and braces: the table owner (migrations) is the only role that may alter history
create function private.block_audit_mutation() returns trigger language plpgsql as $$
begin
  if current_user = 'postgres' then return coalesce(new, old); end if;
  raise exception 'audit_log is append-only' using errcode = '42501';
end $$;
create trigger audit_log_append_only before update or delete on audit_log for each row execute function private.block_audit_mutation();
