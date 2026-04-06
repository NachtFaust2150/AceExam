import { gql } from '@apollo/client/core';

// ===================== AUTH =====================
export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      role
      user {
        id
        name
        email
        disabilityType
        assignedExams
      }
    }
  }
`;

export const ME = gql`
  query Me {
    me {
      id
      name
      email
      role
      disabilityType
      assignedExams
    }
  }
`;

// ===================== ORG =====================
export const GET_TEACHERS = gql`
  query GetTeachers {
    teachers {
      id
      name
      email
    }
  }
`;

export const ADD_TEACHER = gql`
  mutation AddTeacher($name: String!, $email: String!, $password: String!) {
    addTeacher(name: $name, email: $email, password: $password) {
      id
      name
      email
    }
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($id: String!) {
    deleteUser(id: $id) {
      ok
    }
  }
`;

// ===================== EXAMS =====================
export const GET_EXAMS = gql`
  query GetExams {
    exams {
      id
      title
      createdAt
      questionsCount
    }
  }
`;

export const GET_EXAM = gql`
  query GetExam($id: String!) {
    exam(id: $id) {
      id
      title
      createdAt
      questionsCount
    }
  }
`;

export const CREATE_EXAM = gql`
  mutation CreateExam($title: String!) {
    createExam(title: $title) {
      id
      title
      createdAt
      questionsCount
    }
  }
`;

export const ASSIGN_STUDENT_TO_EXAM = gql`
  mutation AssignStudentToExam($examId: String!, $studentId: String!, $assign: Boolean!) {
    assignStudentToExam(examId: $examId, studentId: $studentId, assign: $assign) {
      ok
    }
  }
`;

// ===================== QUESTIONS =====================
export const GET_QUESTIONS = gql`
  query GetQuestions($examId: String!) {
    questions(examId: $examId) {
      id
      examId
      text
      options
      difficulty
    }
  }
`;

export const GET_ALL_QUESTIONS = gql`
  query GetAllQuestions($examId: String!) {
    allQuestions(examId: $examId) {
      id
      examId
      text
      options
      correctAnswer
      difficulty
    }
  }
`;

export const ADD_QUESTION = gql`
  mutation AddQuestion(
    $examId: String!
    $text: String!
    $optionA: String!
    $optionB: String!
    $optionC: String!
    $optionD: String!
    $correctAnswer: String!
    $difficulty: String
  ) {
    addQuestion(
      examId: $examId
      text: $text
      optionA: $optionA
      optionB: $optionB
      optionC: $optionC
      optionD: $optionD
      correctAnswer: $correctAnswer
      difficulty: $difficulty
    ) {
      id
      examId
      text
      options
      correctAnswer
      difficulty
    }
  }
`;

export const UPDATE_QUESTION = gql`
  mutation UpdateQuestion(
    $id: String!
    $text: String
    $optionA: String
    $optionB: String
    $optionC: String
    $optionD: String
    $correctAnswer: String
    $difficulty: String
  ) {
    updateQuestion(
      id: $id
      text: $text
      optionA: $optionA
      optionB: $optionB
      optionC: $optionC
      optionD: $optionD
      correctAnswer: $correctAnswer
      difficulty: $difficulty
    ) {
      id
      examId
      text
      options
      correctAnswer
      difficulty
    }
  }
`;

export const DELETE_QUESTION = gql`
  mutation DeleteQuestion($id: String!) {
    deleteQuestion(id: $id) {
      ok
    }
  }
`;

// ===================== STUDENTS =====================
export const GET_STUDENTS = gql`
  query GetStudents {
    students {
      id
      name
      email
      disabilityType
      assignedExams
    }
  }
`;

export const ADD_STUDENT = gql`
  mutation AddStudent(
    $name: String!
    $email: String!
    $password: String!
    $disabilityType: String
  ) {
    addStudent(
      name: $name
      email: $email
      password: $password
      disabilityType: $disabilityType
    ) {
      id
      name
      email
      disabilityType
      assignedExams
    }
  }
`;

export const UPDATE_STUDENT = gql`
  mutation UpdateStudent(
    $id: String!
    $name: String
    $email: String
    $password: String
    $disabilityType: String
  ) {
    updateStudent(
      id: $id
      name: $name
      email: $email
      password: $password
      disabilityType: $disabilityType
    ) {
      id
      name
      email
      disabilityType
      assignedExams
    }
  }
`;

export const DELETE_STUDENT = gql`
  mutation DeleteStudent($id: String!) {
    deleteStudent(id: $id) {
      ok
    }
  }
`;

// ===================== EXAM RESULTS =====================
export const SUBMIT_EXAM = gql`
  mutation SubmitExam($examId: String!, $answers: JSONString!, $timeTaken: Int!) {
    submitExam(examId: $examId, answers: $answers, timeTaken: $timeTaken) {
      id
      examId
      score
      total
      timeTaken
      submittedAt
    }
  }
`;

export const GET_EXAM_RESULTS = gql`
  query GetExamResults($examId: String, $studentId: String) {
    examResults(examId: $examId, studentId: $studentId) {
      id
      examId
      studentId
      studentName
      answers
      score
      total
      timeTaken
      submittedAt
    }
  }
`;
