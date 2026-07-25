# Lookly cloud setup

This folder prepares Lookly for a small private pilot. It gives every signed-in
user separate records and separate private photo storage.

After creating a Supabase project, open **SQL Editor**, run `schema.sql`, and
then provide the project URL and anon key through a local `.env` file. Never
put a service-role key in the Expo app or commit either key to Git.

The next implementation step will connect the mobile app to Supabase Auth,
these tables, and the `lookly-private` photo bucket.
