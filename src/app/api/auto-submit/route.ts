import { prisma } from "@/lib/db";

export async function GET() {
  const now = new Date();

  // Find submissions that are still IN_PROGRESS but past their due time
  const overdueSubs = await prisma.testSubmission.findMany({
    where: {
      status: "IN_PROGRESS",
      OR: [
        {
          test: {
            dueDate: { lt: now }, // past due date
          },
        },
        {
          // past time limit since started
          AND: [
            { startedAt: { not: undefined } },
            {
              test: {
                timeLimit: { not: null },
              },
            },
            {
              startedAt: {
                lt: new Date(now.getTime() - 1000 * 60 * 60), // fallback 1h ago
              },
            },
          ],
        },
      ],
    },
    include: { test: true },
  });

  for (const sub of overdueSubs) {
    let endTime = sub.test.dueDate;

    if (sub.test.timeLimit && sub.startedAt) {
      const limitEnd = new Date(
        sub.startedAt.getTime() + sub.test.timeLimit * 60_000
      );
      // whichever is earlier: timeLimit vs dueDate
      endTime = new Date(Math.min(endTime.getTime(), limitEnd.getTime()));
    }

    if (now >= endTime) {
      await prisma.testSubmission.update({
        where: { id: sub.id },
        data: {
          status: "SUBMITTED",
          submittedAt: now,
        },
      });
    }
  }

  return new Response(
    JSON.stringify({ checked: overdueSubs.length, time: now }),
    { status: 200 }
  );
}
