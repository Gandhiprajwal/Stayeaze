import { useState } from 'react';
import { 
  Mail, Phone, MapPin, Send, MessageSquare, Clock, CheckCircle2 
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Navbar } from '@/components/public/Navbar';
import { Footer } from '@/components/public/Footer';
import api from '@/lib/api';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('Sales & Pricing');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !message) {
      toast.error('Please complete all required fields.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/public/leads', {
        name,
        email,
        phone,
        propertyName: category,
        message,
      });
      setSubmitted(true);
      toast.success('Thank you! Our onboarding team will contact you shortly.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit lead inquiry.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
      <Navbar />

      <main className="pt-32 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10">
            Contact Support & Sales
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white font-heading">
            We're Here to Help You Scale
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Have questions about property setup, Razorpay keys, or enterprise multi-branch onboarding? Get in touch with our team.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Form */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl space-y-6 shadow-md">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Send Us a Message
            </h3>

            {submitted ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-6 rounded-xl text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <h4 className="font-bold text-slate-900 dark:text-white text-lg">Message Submitted!</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  We have received your query. A dedicated account manager will contact you at <strong>{email}</strong> shortly.
                </p>
                <Button variant="outline" onClick={() => setSubmitted(false)} className="text-xs border-slate-300 dark:border-slate-700">
                  Send Another Inquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-name" required className="text-slate-800 dark:text-slate-200">Your Full Name</Label>
                    <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rajesh Sharma" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email" required className="text-slate-800 dark:text-slate-200">Email Address</Label>
                    <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rajesh@stayeaze.com" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-phone" className="text-slate-800 dark:text-slate-200">Mobile Number</Label>
                    <Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-category" className="text-slate-800 dark:text-slate-200">Inquiry Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="contact-category" className="w-full bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sales & Pricing">Sales &amp; Pricing</SelectItem>
                        <SelectItem value="Technical Support">Technical Support</SelectItem>
                        <SelectItem value="Razorpay Gateway Setup">Razorpay Gateway Setup</SelectItem>
                        <SelectItem value="Enterprise Custom Plan">Enterprise Custom Plan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact-message" required className="text-slate-800 dark:text-slate-200">Message Details</Label>
                  <Textarea id="contact-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Tell us about your property capacity and requirements..." className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white" />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold">
                  {isSubmitting ? 'Submitting...' : 'Submit Message'} <Send className="ml-2 h-4 w-4" />
                </Button>
              </form>
            )}
          </div>

          {/* Contact Cards */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4 shadow-md">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Office Locations</span>
              
              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 dark:text-white">Gurugram HQ:</strong> Sector 44, Golf Course Extension, Gurugram, Haryana 122003
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 dark:text-white">Bengaluru Regional:</strong> HSR Layout, Sector 6, Bengaluru, Karnataka 560102
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 dark:text-white">Hyderabad Tech Hub:</strong> HITEC City, Hyderabad, Telangana 500081
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-3 shadow-md">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Support Response SLA
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Email support is monitored 24/7. Priority phone support is available Mon–Sat from 9:00 AM to 8:00 PM IST for Pro and Enterprise subscribers.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
