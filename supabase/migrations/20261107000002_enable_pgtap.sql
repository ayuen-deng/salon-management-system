-- Enable pgTAP for the project's database test suite in local and hosted environments.
create extension if not exists pgtap with schema extensions;
