import SignupForm from "@/components/auth/signup-form";
import SiteHeader from "@/components/layout/site-header";
import SiteFooter from "@/components/layout/site-footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-grow container mx-auto flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <Card className="shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="font-headline text-3xl text-primary">Create an Account</CardTitle>
              <CardDescription>Join InvoiceEase to start managing your invoices effortlessly.</CardDescription>
            </CardHeader>
            <CardContent>
              <SignupForm />
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
