import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Send } from 'lucide-react';
import { sendEmailNotification } from '../utils/emailService';

const EmailTest = () => {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const sendTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: 'Error',
        description: 'Please enter a test email address.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await sendEmailNotification('schedule_created', testEmail, {
        trainerName: 'Test Trainer',
        date: '2024-01-15',
        client: 'Test Client',
        course: 'React Training',
        role: 'Trainer'
      });
      
      toast({
        title: 'Success!',
        description: 'Test email sent successfully. Check your inbox!',
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test email. Check console for details.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            EmailJS Test
          </CardTitle>
          <CardDescription>
            Test your EmailJS configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="testEmail">Test Email Address</Label>
            <Input
              id="testEmail"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="your-email@example.com"
            />
          </div>
          <Button 
            onClick={sendTestEmail} 
            disabled={loading || !testEmail}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            {loading ? 'Sending...' : 'Send Test Email'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailTest; 