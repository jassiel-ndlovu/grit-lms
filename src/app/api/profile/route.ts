import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/db';

const secret = process.env.NEXTAUTH_SECRET;

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret });

  if (!token?.id || !token?.role) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role')?.toLowerCase();

  try {
    if (role === 'student') {
      const student = await prisma.student.findUnique({
        where: { email: token.email },
      });

      return NextResponse.json(student);
    } else if (role === 'tutor') {
      const tutor = await prisma.tutor.findUnique({
        where: { email: token.email },
      });

      return NextResponse.json(tutor);
    } else {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Server error: ' + err }, { status: 500 });
  }
}
