import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getToken } from 'next-auth/jwt';

export async function GET() {
    const courses = await prisma.course.findMany({
        include: {
            tutor: true,
            students: true,
            lessons: true,
            quizzes: true,
            tests: true,
            submissions: true,
            courseEvents: true,
        },
    });

    return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
    const token = await getToken({ req });

    if (!token || token.role !== 'TUTOR') {
        return new NextResponse('Unauthorized', { status: 403 });
    }

    const data = await req.json();

    const created = await prisma.course.create({
        data: {
            name: data.courseName,
            description: data.description,
            imageUrl: data.courseImageUrl,
            tutor: {
                connect: { id: token.id },
            },
        },
        include: {
            tutor: true,
            students: true,
            lessons: true,
            quizzes: true,
            tests: true,
            submissions: true,
            courseEvents: true,
        },
    });

    return NextResponse.json(created);
}
