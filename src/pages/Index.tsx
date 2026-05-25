import { BuyerForm } from "@/components/BuyerForm";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-20">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Supplier discovery with reusable intelligence
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Capture sourcing requirements once, compare against prior investigations,
            enrich supplier data, and surface a contact-ready shortlist.
          </p>
        </header>

        {/* Form Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm md:p-12">
          <BuyerForm />
        </div>

        {/* Footer Note */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Designed to reduce manual research while preserving a clear audit trail for the buying team.
        </p>
      </div>
    </div>
  );
};

export default Index;
