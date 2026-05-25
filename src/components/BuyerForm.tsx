import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitRequirement } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const formSchema = z.object({
  companyName: z.string().trim().min(2, {
    message: "Company name must be at least 2 characters.",
  }).max(100),
  contactName: z.string().trim().min(2, {
    message: "Contact name must be at least 2 characters.",
  }).max(100),
  email: z.string().trim().email({
    message: "Please enter a valid email address.",
  }).max(255),
  phone: z.string().trim().min(10, {
    message: "Please enter a valid phone number.",
  }).max(20),
  productService: z.string().trim().min(5, {
    message: "Please describe what you're looking for (minimum 5 characters).",
  }).max(500),
  quantity: z.string().trim().min(1, {
    message: "Please specify the quantity needed.",
  }).max(100),
  budgetRange: z.string().min(1, {
    message: "Please select a budget range.",
  }),
  timeline: z.string().min(1, {
    message: "Please select your timeline.",
  }),
  specifications: z.string().trim().max(2000).optional(),
});

export function BuyerForm() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      productService: "",
      quantity: "",
      budgetRange: "",
      timeline: "",
      specifications: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      const payload = {
        companyName: values.companyName,
        contactName: values.contactName,
        email: values.email,
        phone: values.phone,
        productDescription: values.productService,
        quantity: values.quantity,
        budgetRange: values.budgetRange,
        timeline: values.timeline,
        specifications: values.specifications || "",
      };
      
      const tempId = `temp_${Date.now()}`;
      
      navigate("/processing", { 
        state: { 
          investigation_id: tempId,
          isProcessing: true
        } 
      });
      const data = await submitRequirement(payload);

      if (data.status === "completed" && data.suppliers.length > 0) {
        navigate("/results", {
          state: {
            investigation_id: data.investigation_id,
            cached: data.cached,
            suppliers: data.suppliers,
            timestamp: data.timestamp,
            message: data.message,
          },
          replace: true,
        });
        form.reset();
        return;
      }

      navigate("/processing", { 
        state: { 
          investigation_id: data.investigation_id,
          isProcessing: false,
          cached: data.cached,
        },
        replace: true
      });

      form.reset();
    } catch (error) {
      console.error("Error submitting requirements:", error);
      toast.error("Failed to submit requirements. Please ensure the backend is running.");
      navigate("/", { replace: true });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Company & Contact Information */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Company Information</h2>
            <p className="text-sm text-muted-foreground">Tell us about your organization</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corporation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@acme.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+1 (555) 000-0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Requirements */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Your Requirements</h2>
            <p className="text-sm text-muted-foreground">Provide details about what you're sourcing</p>
          </div>

          <FormField
            control={form.control}
            name="productService"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product or Service Needed</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the product or service you're looking for..."
                    className="min-h-[100px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Be as specific as possible to help us find the best suppliers
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-6 md:grid-cols-3">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 1000 units" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="budgetRange"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budget Range</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="under-10k">Under $10,000</SelectItem>
                      <SelectItem value="10k-50k">$10,000 - $50,000</SelectItem>
                      <SelectItem value="50k-100k">$50,000 - $100,000</SelectItem>
                      <SelectItem value="100k-500k">$100,000 - $500,000</SelectItem>
                      <SelectItem value="over-500k">Over $500,000</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timeline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timeline</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timeline" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent (1-2 weeks)</SelectItem>
                      <SelectItem value="1-month">1 Month</SelectItem>
                      <SelectItem value="1-3-months">1-3 Months</SelectItem>
                      <SelectItem value="3-6-months">3-6 Months</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="specifications"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Specifications (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Include any technical specifications, certifications, quality requirements, or other details..."
                    className="min-h-[120px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Any additional information that will help us find the right suppliers
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" size="lg" className="w-full md:w-auto" disabled={isLoading}>
          {isLoading ? "Submitting..." : "Submit Requirements"}
        </Button>
      </form>
    </Form>
  );
}
