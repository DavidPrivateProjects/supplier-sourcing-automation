import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Mail, Phone, Globe, MapPin, MessageSquare } from "lucide-react";
import { useState } from "react";
import type { Supplier } from "@/lib/api";

interface SupplierCardProps {
  supplier: Supplier;
}

export function SupplierCard({ supplier }: SupplierCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const conversationLog = supplier.conversation_log ?? [];

  const roleLabel = (role: string) => {
    if (role === "buyer") return "Buyer outreach";
    if (role === "supplier") return "Supplier reply";
    return "System insight";
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-xl">{supplier.name}</CardTitle>
            <CardDescription className="mt-2 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {supplier.location}
            </CardDescription>
          </div>
          <Badge variant={supplier.match_score >= 90 ? "default" : "secondary"} className="text-sm font-semibold">
            {supplier.match_score}% Match
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Contact Information */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <a href={`mailto:${supplier.contact_email}`} className="hover:text-foreground transition-colors">
              {supplier.contact_email}
            </a>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <a href={`tel:${supplier.contact_phone}`} className="hover:text-foreground transition-colors">
              {supplier.contact_phone}
            </a>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4" />
            <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              {supplier.website}
            </a>
          </div>
        </div>

        {/* Capabilities */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Capabilities</p>
          <div className="flex flex-wrap gap-2">
            {supplier.capabilities.map((capability, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {capability}
              </Badge>
            ))}
          </div>
        </div>

        {/* Conversation Log */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Contact Validation ({conversationLog.length} messages)
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              {conversationLog.map((turn, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${turn.role === "system" ? "text-primary" : "text-muted-foreground"}`}>
                      {roleLabel(turn.role)}
                    </span>
                    <span className="text-xs text-muted-foreground">{turn.timestamp}</span>
                  </div>
                  <p className="text-sm text-foreground">{turn.content}</p>
                  {index < conversationLog.length - 1 && <div className="mt-3 h-px bg-border" />}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
