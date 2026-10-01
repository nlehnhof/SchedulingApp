import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess, requireWriteRole, calendarOwnerTier } from '@/lib/require-calendar';
import { buildContactsCsv } from '@/lib/csv-export';
import { isAtLeast } from '@/lib/tier';
import { errorResponse } from '@/lib/error-response';

// L10: opted-in contacts for ONE calendar, Premium+ (owner's tier). Only rows
// with email_marketing_optin = true are read, so pre-existing appointments
// (default false) are never exported.
export async function GET(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;
  const writeError = requireWriteRole(calendar.role);
  if (writeError) return writeError;

  if (!isAtLeast(await calendarOwnerTier(calendar.calendarId), 'premium')) {
    return NextResponse.json({ error: 'Marketing contacts export is a Premium feature.' }, { status: 403 });
  }

  const { data, error } = await createServiceClient()
    .from('appointments')
    .select('visitor_name, visitor_email, email_marketing_optin_at')
    .eq('calendar_id', calendar.calendarId)
    .eq('email_marketing_optin', true);
  if (error) return errorResponse(error, 'Could not export contacts.');

  return new NextResponse(buildContactsCsv(data ?? []), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="marketing-contacts.csv"',
    },
  });
}
