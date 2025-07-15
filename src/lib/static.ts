const tutor: Tutor = {
  tutorId: "1",
  fullName: "Nkosenhle Ndlovu",
  email: "nkosijassiel@gmail.com",
  profileImageUrl: "/images/tutor-avatar.png",
  bio: "Experienced IT and Mathematics educator passionate about preparing students for real-world coding and exams."
}

export const assessments: Assessment[] = [
  {
    id: "1",
    title: "Quiz 1: Java Basics",
    courseId: "1",
    dueDate: "2025-06-26T17:00:00",
    createdAt: "2025-06-10T08:00:00",
    completedBy: [
      {
        studentId: "stu-101",
        startedAt: "2025-06-20T14:00:00",
        completedAt: "2025-06-20T14:30:00",
        score: 88
      }
    ]
  },
  {
    id: "2",
    title: "Monthly Test: Calculus",
    courseId: "2",
    dueDate: "2025-06-30T13:30:00",
    createdAt: "2025-06-15T10:00:00",
    completedBy: []
  }
]

export const submissions: Submission[] = [
  {
    id: "1",
    title: "Java Project Submission",
    courseId: "it",
    dueDate: "2025-06-24T23:59:00",
    fileType: "zip",
    completedBy: [
      {
        studentId: "stu-101",
        submittedAt: "2025-06-24T20:15:00",
        fileUrl: "/uploads/stu-101-java-project.zip",
        grade: 92
      }
    ]
  },
  {
    id: "2",
    title: "Maths Worksheet",
    courseId: "maths",
    dueDate: "2025-06-25T18:00:00",
    fileType: "pdf",
    completedBy: []
  }
]

export const courses: Course[] = [
  {
    courseId: "1",
    courseName: "Mathematics G12",
    tutor: tutor,
    description:
      "This course covers the full South African CAPS curriculum for Grade 12 Mathematics, including Algebra, Trigonometry, Calculus, Probability, and Geometry. It includes lessons, tests, and past paper practice.",
    courseImageUrl: "/images/course-image-2.jpeg",
    enrolledStudents: [],
    lessons: [
      {
        id: "m1",
        title: "Algebra: Quadratic Equations",
        courseId: "1",
        description: "Solving quadratic equations using factorisation, completing the square, and the quadratic formula.",
        videoUrl: [ "/videos/quadratics.mp4" ],
        resourceLinks: [
          { title: "Quadratics Worksheet", url: "/resources/quadratics-worksheet.pdf" },
          { title: "Formula Sheet", url: "/resources/formulas.pdf" }
        ],
        completedBy: []
      },
      {
        id: "m2",
        title: "Trigonometry: Identities",
        courseId: "1",
        description: "Understanding and proving basic trigonometric identities using known formulas.",
        videoUrl: [ "/videos/trig-identities.mp4" ],
        resourceLinks: [{ title: "Trig Practice", url: "/resources/trig-practice.pdf" }],
        completedBy: []
      },
      {
        id: "m3",
        title: "Calculus: Derivatives",
        courseId: "1",
        description: "Intro to differential calculus and applying first principles.",
        videoUrl: [ "/videos/derivatives-intro.mp4" ],
        resourceLinks: [{ title: "Derivatives Worksheet", url: "/resources/derivatives.pdf" }],
        completedBy: []
      },
      {
        id: "m4",
        title: "Euclidean Geometry: Circles",
        courseId: "1",
        description: "Exploring theorems related to angles and chords in circles.",
        videoUrl: [ "/videos/geometry-circles.mp4" ],
        resourceLinks: [{ title: "Geometry Notes", url: "/resources/geometry-circles.pdf" }],
        completedBy: []
      }
    ],
    activeQuizzes: [],
    activeTests: [],
    activeSubmissions: [],
    courseEvents: [
      {
        id: "1",
        courseId: "1",
        title: "Math Teams Meeting",
        date: "2025-06-25T17:00:00",
        link: "https://teams.microsoft.com/l/meetup-1234"
      }
    ]
  },
  {
    courseId: "2",
    courseName: "Information Technology G12",
    tutor: tutor,
    description:
      "This course teaches Java programming, databases, and theory aligned to the South African CAPS curriculum for Grade 12 IT. Includes projects, quizzes, and real-time code evaluation.",
    courseImageUrl: "/images/course-image-7.jpeg",
    enrolledStudents: [],
    lessons: [
      {
        id: "it1",
        title: "Java Basics: Variables & Types",
        courseId: "2",
        description: "Learn Java syntax, data types, and basic variable operations.",
        videoUrl: [ "/videos/java-variables.mp4" ],
        resourceLinks: [
          { title: "Java Basics Notes", url: "/resources/java-variables.pdf" },
          { title: "Code Examples", url: "/resources/java-examples.zip" }
        ],
        completedBy: []
      },
      {
        id: "it2",
        title: "Control Structures: If & Switch",
        courseId: "2",
        description: "Master conditional logic using if-else and switch-case statements.",
        videoUrl: [ "/videos/java-conditions.mp4" ],
        resourceLinks: [{ title: "Conditionals Practice", url: "/resources/conditionals.pdf" }],
        completedBy: []
      },
      {
        id: "it3",
        title: "Loops in Java",
        courseId: "2",
        description: "Understand and implement for, while, and do-while loops.",
        videoUrl: [ "/videos/java-loops.mp4" ],
        resourceLinks: [{ title: "Loops Worksheet", url: "/resources/loops.pdf" }],
        completedBy: []
      },
      {
        id: "it4",
        title: "Classes and Objects",
        courseId: "2",
        description: "Introduction to OOP in Java, covering class creation and instantiation.",
        videoUrl: [ "/videos/java-oop.mp4" ],
        resourceLinks: [{ title: "OOP Guide", url: "/resources/oop.pdf" }],
        completedBy: []
      }
    ],
    activeQuizzes: [],
    activeTests: [],
    activeSubmissions: [],
    courseEvents: [
      {
        id: "2",
        courseId: "2",
        title: "IT Project Check-In",
        date: "2025-06-27T15:30:00",
        link: "https://teams.microsoft.com/l/meetup-5678"
      }
    ]
  }
];
