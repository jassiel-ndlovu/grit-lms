import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {

    // Hash passwords
    const tutorPassword = await bcrypt.hash('Jassiel1234#1', 10);
    const studentTestPassword = await bcrypt.hash('Test1234#1', 10);
    const mbaliPassword = await bcrypt.hash('Mbali1034!49', 10);
    const anesuPassword = await bcrypt.hash('Anesu672$27', 10);
    const bethelPassword = await bcrypt.hash('Bethel982*4782', 10);

    const anashePassword = await bcrypt.hash('Anashe672$27', 10);
    const joshuaPassword = await bcrypt.hash('Joshua459@53', 10);

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
          email: 'mbalienhle.mzimba@gmail.com',
          password: mbaliPassword,
          role: 'STUDENT',
        },
        {
          name: 'Anesu Musungo',
          email: 'anesumusungo3@gmail.com',
          password: anesuPassword,
          role: 'STUDENT',
        },
        {
          name: "Bethel Musungo",
          email: "Bethmusungo@gmail.com",
          password: bethelPassword,
          role: 'STUDENT',
        },
        {
          name: "Anashe Musungo",
          email: "ana.hegrace@gmail.com",
          password: anashePassword,
          role: 'STUDENT',
        },
        {
          name: "Joshua Chanakira",
          email: "Chanakirajoshua69@gmail.com",
          password: joshuaPassword,
          role: 'STUDENT',
        }
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
          email: 'mbalienhle.mzimba@gmail.com',
        },
        {
          fullName: 'Anesu Musungo',
          email: 'anesumusungo3@gmail.com',
        },
        {
          fullName: 'Test Student',
          email: 'test@test.com',
        },
        {
          fullName: 'Bethel Musungo',
          email: 'Bethmusungo@gmail.com'
        },
        {
          fullName: "Anashe Musungo",
          email: "ana.hegrace@gmail.com"
        },
        {
          fullName: "Joshua Chanakira",
          email: "Chanakirajoshua69@gmail.com"
        }
      ],
      skipDuplicates: true,
    });

    return NextResponse.json({ message: 'Seed successful' }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Seed failed with error: ' + error }, { status: 500 });
  }
}
