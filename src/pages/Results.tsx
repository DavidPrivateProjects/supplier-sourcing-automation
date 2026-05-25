import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, Database, Target } from "lucide-react";
import { SupplierCard } from "@/components/SupplierCard";
import { Button } from "@/components/ui/button";
import type { Supplier } from "@/lib/api";

interface ResultsData {
  investigation_id: string;
  cached: boolean;
  suppliers: Supplier[];
  message?: string;
  timestamp?: string;
}

const Results = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const resultsData = location.state as ResultsData | null;

  useEffect(() => {
    if (!resultsData) {
      navigate("/");
    }
  }, [resultsData, navigate]);

  if (!resultsData) {
    return null;
  }

  const { investigation_id, cached, suppliers, message, timestamp } = resultsData;

  if (!suppliers || suppliers.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-20">
          <div className="mb-8">
            <Button variant="ghost" onClick={() => navigate("/")} className="mb-4 -ml-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Form
            </Button>
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                No Suppliers Found
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                We couldn't find any matching suppliers for your requirements. Please try submitting a new request with different criteria.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const averageScore = Math.round(
    suppliers.reduce((total, supplier) => total + supplier.match_score, 0) / suppliers.length
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-20">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-4 -ml-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Form
          </Button>

          <div className="mb-6 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Suppliers Found
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Investigation ID: {investigation_id}
                {cached && <span className="ml-2 text-xs">(Cached Result)</span>}
              </p>
            </div>
          </div>

          <p className="text-lg text-muted-foreground">
            We've matched you with {suppliers.length} qualified supplier{suppliers.length !== 1 ? "s" : ""} based on your requirements.
          </p>
          {message && (
            <p className="mt-2 text-sm text-muted-foreground">
              {message}
            </p>
          )}
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <Target className="mb-3 h-5 w-5 text-primary" />
            <p className="text-2xl font-semibold">{averageScore}%</p>
            <p className="text-sm text-muted-foreground">Average fit score across returned suppliers</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <Database className="mb-3 h-5 w-5 text-primary" />
            <p className="text-2xl font-semibold">{cached ? "Reused" : "Fresh"}</p>
            <p className="text-sm text-muted-foreground">Result source for faster repeat sourcing</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <Clock className="mb-3 h-5 w-5 text-primary" />
            <p className="text-2xl font-semibold">Ready</p>
            <p className="text-sm text-muted-foreground">
              {timestamp ? `Generated ${new Date(timestamp).toLocaleString()}` : "Generated for review"}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          {suppliers.map((supplier) => (
            <SupplierCard
              key={`${supplier.name}-${supplier.contact_email}`}
              supplier={supplier}
            />
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Review the shortlist, validate commercial terms, and use the captured contact path for fast follow-up.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Results;
