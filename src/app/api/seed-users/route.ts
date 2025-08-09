import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {

    // Hash passwords
    const tutorPassword = await bcrypt.hash('Jassiel1234#1', 10);
    const studentTestPassword = await bcrypt.hash('Test1234#1', 10);
    const mbaliPassword = await bcrypt.hash('Mbali1034!42', 10);
    const anesuPassword = await bcrypt.hash('Anesu672$23', 10);

    // Create users
    await prisma.user.createMany({
      data: [
        {
          name: 'Nkosenhle Jassiel Ndlovu',
          email: 'nkosijassiel@gmail.com',
          password: tutorPassword,
          role: 'TUTOR',
        },
        {
          name: 'Test Student',
          email: 'test@test.com',
          password: studentTestPassword,
          role: 'STUDENT',
        },
        {
          name: 'Mbalienhle Mzimba',
          email: 'mbalienhlemzimba@gmail.com',
          password: mbaliPassword,
          role: 'STUDENT',
        },
        {
          name: 'Anesu Musungo',
          email: 'anesumusungo3@gmail.com',
          password: anesuPassword,
          role: 'STUDENT',
        },
      ],
      skipDuplicates: true,
    });

    // Create tutor and students
    await prisma.tutor.createMany({
      data: {
        fullName: 'Nkosenhle Jassiel Ndlovu',
        email: 'nkosijassiel@gmail.com',
        bio: 'Mathematics and IT tutor.',
      },
      skipDuplicates: true,
    });

    await prisma.student.createMany({
      data: [
        {
          fullName: 'Mbalienhle Mzimba',
          email: 'mbalienhlemzimba@gmail.com',
        },
        {
          fullName: 'Anesu Musungo',
          email: 'anesumusungo3@gmail.com',
        },
        {
          fullName: 'Test Student',
          email: 'test@test.com',
        },
      ],
      skipDuplicates: true,
    });

    return NextResponse.json({ message: 'Seed successful' }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Seed failed with error: ' + error }, { status: 500 });
  }
}
