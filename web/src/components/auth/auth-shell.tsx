import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authConfigured } from "@/lib/firebase-config";

/** The narrow, centred card every account page sits in. */
export function AuthShell({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  /** Below the card, such as a link to the other form. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {authConfigured ? (
            children
          ) : (
            <Alert>
              <AlertTitle>Sign-in isn&apos;t set up</AlertTitle>
              <AlertDescription>This site was built without a Firebase project, so accounts aren&apos;t available.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      {footer && authConfigured ? <p className="mt-4 text-center text-sm text-muted-foreground">{footer}</p> : null}
    </main>
  );
}

/** A labelled input. */
export function Field({ label, id, ...input }: { label: string; id: string } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="h-9" {...input} />
    </div>
  );
}

/** A message under a form: an error, or a notice such as "email sent". */
export function FormMessage({ tone = "error", children }: { tone?: "error" | "notice"; children: React.ReactNode }) {
  return (
    <Alert variant={tone === "error" ? "destructive" : "default"} aria-live="polite">
      <AlertDescription className={tone === "error" ? undefined : "text-foreground"}>{children}</AlertDescription>
    </Alert>
  );
}
