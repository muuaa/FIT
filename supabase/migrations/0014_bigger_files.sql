-- Videos: allow files up to 50 MB (the plan's maximum).
update storage.buckets set file_size_limit = 52428800 where id = 'files';
