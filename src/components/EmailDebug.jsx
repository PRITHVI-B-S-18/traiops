import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Send, Bug } from 'lucide-react';
import { EMAILJS_CONFIG } from '../config/emailjs';

const EmailDebug = () => {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const testEmailJS = async () => {
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
      // Test with different variable names
      const testData = {
        to_email: testEmail,
        to: testEmail,
        email: testEmail,
        recipient: testEmail,
        trainer_name: 'Test Trainer',
        date: '2024-01-15',
        client: 'Test Client',
        course: 'React Training',
        role: 'Trainer',
        email_subject: 'Test Email',
        email_title: 'Test Email',
        email_message: 'This is a test email.',
        action_message: 'Please confirm receipt.'
      };

      console.log('Sending test email with data:', testData);

      const response = await window.emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATES.SCHEDULE_CREATED,
        testData
      );

      console.log('EmailJS response:', response);
      
      toast({
        title: 'Success!',
        description: 'Test email sent successfully. Check your inbox!',
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: 'Error',
        description: `Failed to send test email: ${error.text || error.message}`,
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
            <Bug className="w-5 h-5" />
            EmailJS Debug
          </CardTitle>
          <CardDescription>
            Debug EmailJS configuration and variables
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
            onClick={testEmailJS} 
            disabled={loading || !testEmail}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            {loading ? 'Sending...' : 'Send Debug Email'}
          </Button>
          <div className="text-xs text-gray-600">
            <p>This will test with multiple variable names:</p>
            <p>• to_email</p>
            <p>• to</p>
            <p>• email</p>
            <p>• recipient</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailDebug; 