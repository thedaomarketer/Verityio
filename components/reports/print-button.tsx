"use client";

import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog, where "Save as PDF" produces the report (print styles hide the app chrome). */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
      <FileDown /> {label}
    </Button>
  );
}
