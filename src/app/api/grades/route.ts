/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { $Enums } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const courseId = searchParams.get("courseId");
  const testSubId = searchParams.get("submissionId");
  const type = searchParams.get("type");

  try {
    let grades: any;

    if (testSubId && studentId) {
      grades = await prisma.grade.findUnique({
        where: {
          studentId: studentId,
          testSubmissionId: testSubId,
        },
      });
    } else {
      grades = await prisma.grade.findMany({
        where: {
          studentId: studentId || undefined,
          courseId: courseId || undefined,
          type: type || undefined,
        },
      });
    }

    return NextResponse.json(grades);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Failed to fetch grades" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  try {
    // Check if a grade already exists for this submission entry
    if (data.submissionEntryId) {
      const existingGrade = await prisma.grade.findUnique({
        where: { submissionEntryId: data.submissionEntryId }
      });
      
      if (existingGrade) {
        // Update the existing grade instead of creating a new one
        const grade = await prisma.grade.update({
          where: { id: existingGrade.id },
          data: {
            score: data.score,
            outOf: data.outOf,
            finalComments: data.finalComments,
            courseId: data.courseId,
            studentId: data.studentId,
            testSubmissionId: data.testSubmissionId,
            title: data.title,
            type: data.type,
            updatedAt: new Date(),
          }
        });
        
        // Create notification and return response
        return await createNotificationAndRespond(grade);
      }
    }
    
    // Check if a grade already exists for this test submission
    if (data.testSubmissionId) {
      const existingGrade = await prisma.grade.findUnique({
        where: { testSubmissionId: data.testSubmissionId }
      });
      
      if (existingGrade) {
        // Update the existing grade instead of creating a new one
        const grade = await prisma.grade.update({
          where: { id: existingGrade.id },
          data: {
            score: data.score,
            outOf: data.outOf,
            finalComments: data.finalComments,
            courseId: data.courseId,
            studentId: data.studentId,
            testSubmissionId: data.testSubmissionId,
            title: data.title,
            type: data.type,
            updatedAt: new Date(),
          }
        });
        
        // Create notification and return response
        return await createNotificationAndRespond(grade);
      }
    }
    
    // If no existing grade found, create a new one
    const grade = await prisma.grade.create({ data });
    
    // Create notification and return response
    return await createNotificationAndRespond(grade);
    
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Failed to create or update grade" },
      { status: 500 }
    );
  }
}

// Helper function to create notification and return response
async function createNotificationAndRespond(grade: any) {
  let url: string = "/dashboard";
  let ntype: $Enums.NotificationType = "TEST_GRADED";

  if (grade.testSubmissionId) {
    const tsub = await prisma.testSubmission.findUnique({
      where: { id: grade.testSubmissionId },
    });
    url += `/tests/review/${tsub?.testId}`;
  } else if (grade.submissionEntryId) {
    const entry = await prisma.submissionEntry.findUnique({
      where: { id: grade.submissionEntryId },
    });
    url += `/submissions/${entry?.submissionId}`;
    ntype = "SUBMISSION_GRADED";
  }

  await prisma.notification.create({
    data: {
      title: "Grade Released",
      message: `You received ${grade.score}/${grade.outOf} for "${grade.title}".`,
      link: url,
      type: ntype,
      studentId: grade.studentId,
    },
  });

  return NextResponse.json(grade, { status: grade.id ? 200 : 201 });
}