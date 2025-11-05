import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Send, TestTube } from 'lucide-react';
import { sendEmailNotification } from '../utils/emailService';

const EmailJSTest = () => {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const testEmailTypes = [
    {
      type: 'schedule_created',
      label: 'Schedule Created',
      data: {
        trainerName: 'John Doe',
        date: '2024-01-15',
        client: 'Test Client',
        course: 'React Training',
        role: 'Trainer'
      }
    },
    {
      type: 'schedule_updated',
      label: 'Schedule Updated',
      data: {
        trainerName: 'Jane Smith',
        date: '2024-01-16',
        client: 'Updated Client',
        course: 'Advanced React',
        role: 'Lead Trainer'
      }
    },
    {
      type: 'schedule_deleted',
      label: 'Schedule Deleted',
      data: {
        trainerName: 'Mike Johnson',
        date: '2024-01-17',
        client: 'Cancelled Client',
        course: 'Node.js Training'
      }
    }
  ];

  const sendTestEmail = async (emailType, testData) => {
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
      await sendEmailNotification(emailType, testEmail, testData);
      toast({
        title: 'Test Email Sent',
        description: `Test email of type "${emailType}" has been sent successfully.`,
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test email. Please check your EmailJS configuration.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TestTube className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold">EmailJS Test Panel</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Test Configuration
          </CardTitle>
          <CardDescription>
            Enter an email address to receive test emails via EmailJS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="testEmail">Test Email Address</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {testEmailTypes.map((testType) => (
          <Card key={testType.type}>
            <CardHeader>
              <CardTitle className="text-lg">{testType.label}</CardTitle>
              <CardDescription>
                Test {testType.type} email template
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => sendTestEmail(testType.type, testType.data)}
                disabled={loading || !testEmail}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Test
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>1. Sign up at EmailJS: https://www.emailjs.com/</p>
          <p>2. Create Gmail service with your credentials</p>
          <p>3. Create email templates (see setup guide)</p>
          <p>4. Update src/config/emailjs.js with your credentials</p>
          <p>5. Test email functionality</p>
          <p className="text-green-600 font-medium">
            ✅ EmailJS is completely FREE for 200 emails/month!
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailJSTest; 