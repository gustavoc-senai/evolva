export type Row = Record<string, any>;
export type Workspace = {
  id: string;
  owner_id: string;
  name: string;
  phone?: string;
  bio?: string;
  credential?: string;
};
export type Student = {
  id: string;
  workspace_id: string;
  account_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  goal: string | null;
  active: boolean;
  created_at: string;
};
export type Exercise = {
  id: string;
  workspace_id: string | null;
  name: string;
  muscle_group: string;
  equipment: string;
  instructions: string | null;
  video_url: string | null;
  video_path?: string | null;
  source_exercise_id?: string | null;
  active: boolean;
};
export type Workout = {
  id: string;
  workspace_id: string;
  student_id: string;
  title: string;
  notes: string | null;
  status: string;
  created_at: string;
};
export type WorkoutItem = {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  sets: number;
  repetitions: string;
  rest_seconds: number;
  notes: string | null;
};
export type Access = {
  workspace: Workspace;
  role: "TRAINER" | "STUDENT";
  studentId?: string;
  studentName?: string;
};
