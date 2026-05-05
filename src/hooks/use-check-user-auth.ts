import { useAuthStore } from "@/store";

export function useCheckUserAuth(): boolean {
  const user = useAuthStore((s) => s.user);
  return !!user;
}