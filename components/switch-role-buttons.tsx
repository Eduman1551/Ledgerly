"use client";
import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useApp } from "./app-context";

/** Buttons on the role guard: switch persona and stay on this page, or go home. */
export function SwitchRoleButtons({ personas, stayOn, myHome }: { personas: { id: string; label: string }[]; stayOn: string; myHome: string }) {
  const { switchUser } = useApp();
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-2">
      {personas.map((p) => (
        <Button key={p.id} onClick={() => switchUser(p.id, stayOn)}>
          <ArrowLeftRight /> {p.label}
        </Button>
      ))}
      <Button variant="outline" nativeButton={false} render={<Link href={myHome} />}>
        Go to my dashboard
      </Button>
    </div>
  );
}
