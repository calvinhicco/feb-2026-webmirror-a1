# My Students Web Mirror

A web-based mirror application for the My Students Track school management system.

## Deployment Status
- Last updated: February 2026.
- Repository prepared for Feb 2026 web mirror deployment.

## Features

- **Dashboard Overview**: Real-time statistics and data visualization
- **Student Management**: View student records and information
- **Staff Log Sheet**: Daily attendance tracking with role-based grouping
- **Expenses Tracking**: Financial records and expense management
- **Extra Billing**: Additional billing and payment tracking
- **Outstanding Records**: Overdue payments and follow-ups

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel
- **Real-time**: Supabase Realtime subscriptions

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Vercel account (for deployment)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/calvinhicco/feb-2026-webmirror-a1.git
cd MTS-Web-Mirror-main
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Deployment

This application is configured for deployment on Vercel with Supabase as the backend.

### Environment Variables

Set these in your Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── staff/             # Staff log pages
│   ├── students/          # Student management
│   ├── expenses/          # Expense tracking
│   └── layout.tsx         # Root layout
├── components/            # Reusable components
│   ├── ui/               # shadcn/ui components
│   └── Nav.tsx           # Navigation component
├── lib/                  # Utilities and configurations
│   ├── supabase.ts      # Supabase client
│   └── utils.ts         # Helper functions
└── types/               # TypeScript type definitions
```

## Contributing

This is a read-only mirror application. All data modifications should be done through the main desktop application.

## License

Private - Madam Boss Kids Corner School Management System
