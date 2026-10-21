import { createStaffSession, getCurrentStaffSession, type StaffMember } from "@lo-mio/client";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { loadToken, saveToken } from "../../api.ts";

type Session = {
  /** `undefined` mientras se lee el llavero; `null` sin sesión. */
  staff: StaffMember | null | undefined;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Session | undefined>(undefined);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession fuera de <SessionProvider>");
  return session;
}

/** Sesión del personal (12 h): sobrevive a cerrar la app y se valida contra la API al abrirla. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffMember | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      if (!(await loadToken())) return setStaff(null);
      const { data } = await getCurrentStaffSession();
      if (!data) await saveToken(null);
      setStaff(data?.staff ?? null);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await createStaffSession({ body: { email, password } });
    if (!data) return false;
    await saveToken(data.token);
    setStaff(data.staff);
    return true;
  };
  const logout = async () => {
    await saveToken(null);
    setStaff(null);
  };

  return <SessionContext value={{ staff, login, logout }}>{children}</SessionContext>;
}
