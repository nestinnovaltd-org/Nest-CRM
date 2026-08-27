import { 
  GitMerge, 
  Users, 
  Shield, 
  CalendarDays, 
  CreditCard, 
  BarChart3, 
  Bell, 
  Settings,
  Briefcase,
  LayoutDashboard,
  MessageSquare
} from 'lucide-react';

export const SYSTEM_MODULES = [
  { 
    name: 'Dashboard', 
    icon: LayoutDashboard,
    subModules: ['Overview', 'My Performance', 'Team Performance'] 
  },
  {
    name: 'WhatsApp',
    icon: MessageSquare,
    subModules: ['Dashboard', 'Sessions', 'Leads', 'Templates', 'Campaigns', 'Conversations', 'AI Settings', 'Logs']
  },
  { 
    name: 'Project Management', 
    icon: GitMerge,
    subModules: ['All Projects', 'Add New Project'] 
  },
  { 
    name: 'Lead Management', 
    icon: Users,
    subModules: ['All Leads', 'Add New Lead', 'My Leads', 'Follow-Ups', 'Visits', 'Junk Leads'] 
  },
  { 
    name: 'User Management', 
    icon: Shield,
    subModules: ['All Users', 'Add New User', 'User Role and Access'] 
  },
  { 
    name: 'Team Management', 
    icon: Users,
    subModules: ['Overview', 'Create New Team'] 
  },
  { 
    name: 'Calendar & Schedule', 
    icon: CalendarDays,
    subModules: ['Calendar View'] 
  },
  { 
    name: 'Payments', 
    icon: CreditCard,
    subModules: ['All Payments'] 
  },
  { 
    name: 'HR Operations', 
    icon: Briefcase,
    subModules: ['Attendance Check', 'Leave Management', 'Employee Master', 'Payroll Processing', 'Organization Info'] 
  },
  { 
    name: 'Reports & Analytics', 
    icon: BarChart3,
    subModules: ['Sales Reports', 'Lead Conversion', 'Revenue Reports', 'Team Performance'] 
  },
  { 
    name: 'Notifications', 
    icon: Bell,
    subModules: ['Follow-up Alerts'] 
  },
  { 
    name: 'Settings', 
    icon: Settings,
    subModules: ['Profile Settings', 'My Organization'] 
  },
];

