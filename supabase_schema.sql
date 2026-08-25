-- ==========================================
-- Supabase Schema for missing CRM & HR Tables
-- Run this in your Supabase SQL Editor (SQL Editor -> New query -> Paste & Run)
-- ==========================================

-- 1. Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    org_id UUID,
    owner_id UUID,
    members TEXT[] DEFAULT '{}',
    "teamLeads" TEXT[] DEFAULT '{}',
    "teamLead" TEXT,
    "assignedProjects" TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.teams;
CREATE POLICY "Allow public access" ON public.teams FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "projectName" TEXT NOT NULL,
    "clientName" TEXT,
    "startDate" DATE,
    deadline DATE,
    status TEXT DEFAULT 'Planning',
    progress INTEGER DEFAULT 0,
    budget NUMERIC(15, 2) DEFAULT 0.00,
    org_id UUID,
    owner_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.projects;
CREATE POLICY "Allow public access" ON public.projects FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT,
    description TEXT,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    user_id UUID,
    org_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.notifications;
CREATE POLICY "Allow public access" ON public.notifications FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. Deals Table
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID,
    amount NUMERIC(15, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'Open',
    org_id UUID,
    owner_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.deals;
CREATE POLICY "Allow public access" ON public.deals FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. HR Settings Table
CREATE TABLE IF NOT EXISTS public.hr_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID UNIQUE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hr_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.hr_settings;
CREATE POLICY "Allow public access" ON public.hr_settings FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    status TEXT DEFAULT 'Present',
    org_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.attendance;
CREATE POLICY "Allow public access" ON public.attendance FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. Leave Applications Table
CREATE TABLE IF NOT EXISTS public.leave_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type TEXT NOT NULL,
    status TEXT DEFAULT 'Pending',
    reason TEXT,
    org_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.leave_applications;
CREATE POLICY "Allow public access" ON public.leave_applications FOR ALL TO public USING (true) WITH CHECK (true);

-- 8. Salary Payroll Approvals Table
CREATE TABLE IF NOT EXISTS public.salary_payroll_approvals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month TEXT NOT NULL,
    status TEXT DEFAULT 'Pending',
    org_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.salary_payroll_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.salary_payroll_approvals;
CREATE POLICY "Allow public access" ON public.salary_payroll_approvals FOR ALL TO public USING (true) WITH CHECK (true);

-- 9. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    amount NUMERIC(15, 2) DEFAULT 0.00,
    payment_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Pending',
    org_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.payments;
CREATE POLICY "Allow public access" ON public.payments FOR ALL TO public USING (true) WITH CHECK (true);

-- 10. Visit Allowances Table
CREATE TABLE IF NOT EXISTS public.visit_allowances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    amount NUMERIC(15, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'Pending',
    org_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.visit_allowances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.visit_allowances;
CREATE POLICY "Allow public access" ON public.visit_allowances FOR ALL TO public USING (true) WITH CHECK (true);

-- 11. Incentive Claims Table
CREATE TABLE IF NOT EXISTS public.incentive_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    amount NUMERIC(15, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'Pending',
    org_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.incentive_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.incentive_claims;
CREATE POLICY "Allow public access" ON public.incentive_claims FOR ALL TO public USING (true) WITH CHECK (true);


-- ==========================================
-- 12. Alter Existing Tables & Setup Open Policies
-- ==========================================

-- Alter Users Table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reports_to TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS send_email BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS permissions JSONB[] DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS uid UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_package TEXT DEFAULT 'starter';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS target JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.users;
CREATE POLICY "Allow public access" ON public.users FOR ALL TO public USING (true) WITH CHECK (true);

-- Alter Leads Table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone_whatsapp BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS second_phone TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS second_phone_whatsapp BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Fresh Lead';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_follow_up TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_follow_up_date DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.leads;
CREATE POLICY "Allow public access" ON public.leads FOR ALL TO public USING (true) WITH CHECK (true);

-- Alter Book Demo Leads Table
ALTER TABLE public.book_demo_leads ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.book_demo_leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.book_demo_leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.book_demo_leads ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.book_demo_leads ADD COLUMN IF NOT EXISTS custom_domain_requested TEXT;
ALTER TABLE public.book_demo_leads ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.book_demo_leads ADD COLUMN IF NOT EXISTS plan_interest TEXT;
ALTER TABLE public.book_demo_leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE public.book_demo_leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.book_demo_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.book_demo_leads;
CREATE POLICY "Allow public access" ON public.book_demo_leads FOR ALL TO public USING (true) WITH CHECK (true);

-- Alter Organizations Table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.organizations;
CREATE POLICY "Allow public access" ON public.organizations FOR ALL TO public USING (true) WITH CHECK (true);

-- Alter Roles Table
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON public.roles;
CREATE POLICY "Allow public access" ON public.roles FOR ALL TO public USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- Password Reset Tokens Table
-- Used by /api/forgot-password and /api/reset-password
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.password_resets (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email       text NOT NULL,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used        boolean DEFAULT false,
  used_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON public.password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON public.password_resets(email);

-- RLS: Only service role can read/write (called from API backend only)
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only" ON public.password_resets;
CREATE POLICY "Service role only" ON public.password_resets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

