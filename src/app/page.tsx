import { redirect } from "next/navigation";

export default function Home() {
  // Middleware bounces signed-out visitors to /login.
  redirect("/chats");
}
