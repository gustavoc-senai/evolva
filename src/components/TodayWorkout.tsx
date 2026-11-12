import { Link } from "react-router-dom";
import { ArrowUpRight, Dumbbell } from "lucide-react";
import { useRows } from "../lib/hooks";
import { Feedback, Loading } from "./UI";
export default function TodayWorkout({ studentId }: { studentId: string }) {
  const weekly = useRows<any>("evolva_weekly_schedule", { student_id: studentId });
  const workouts = useRows<any>("evolva_workouts", { student_id: studentId });
  const assignment = weekly.rows.find(day => day.weekday === (new Date().getDay()+6)%7+1);
  const workout = workouts.rows.find(workout => workout.id === assignment?.workout_id && workout.status === "PUBLISHED");
  return <section className="panel student-today"><div className="student-today-art"/><div><span className="overline">SEU TREINO DE HOJE</span><Feedback error={weekly.error || workouts.error}/>{weekly.loading || workouts.loading ? <Loading/> : <><h2>{workout?.title || "Seu próximo movimento."}</h2><p>{workout ? "Confira as orientações do seu personal e registre a sessão no seu ritmo." : "Consulte sua rotina semanal e os treinos que seu personal preparou."}</p><Link className="button" to={workout ? `/app/treinos/${workout.id}/executar` : "/app/rotina"}><Dumbbell size={17}/>{workout ? "Começar treino" : "Ver minha semana"}<ArrowUpRight size={16}/></Link></>}</div></section>;
}
