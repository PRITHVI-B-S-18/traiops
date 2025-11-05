import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Send, Settings } from 'lucide-react';
import { EMAILJS_CONFIG } from '../config/emailjs';

const EmailTemplateTest = () => {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState('prithvi.bs@iamneo.ai');
  const [loading, setLoading] = useState(false);

  const testTemplate = async () => {
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
      console.log('Testing EmailJS template with:', {
        serviceId: EMAILJS_CONFIG.SERVICE_ID,
        templateId: EMAILJS_CONFIG.TEMPLATES.SCHEDULE_CREATED,
        toEmail: testEmail
      });

      const testData = {
        to_email: testEmail,
        trainer_name: 'Prithvi B S',
        date: '2024-01-15',
        client: 'Test Client',
        course: 'React Training',
        role: 'Trainer',
        email_subject: 'Test Email - Template Configuration',
        email_title: 'Test Email - Template Configuration',
        email_message: 'This is a test to verify template configuration.',
        action_message: 'Please confirm if you received this email.'
      };

      const response = await window.emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATES.SCHEDULE_CREATED,
        testData,
        EMAILJS_CONFIG.USER_ID
      );

      console.log('EmailJS response:', response);
      
      toast({
        title: 'Success!',
        description: 'Test email sent successfully. Check your inbox!',
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: 'Template Configuration Error',
        description: `Error: ${error.text || error.message}. Please check your EmailJS template configuration.`,
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
            <Settings className="w-5 h-5" />
            Template Configuration Test
          </CardTitle>
          <CardDescription>
            Test if your EmailJS template is configured correctly
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
            onClick={testTemplate} 
            disabled={loading}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            {loading ? 'Testing...' : 'Test Template Configuration'}
          </Button>
          <div className="text-xs text-gray-600 space-y-1">
            <p><strong>Template Configuration Required:</strong></p>
            <p>1. Go to EmailJS Dashboard</p>
            <p>2. Edit template: <code>template_yqneq6j</code></p>
            <p>3. Set "To Email" to: <code>{{to_email}}</code></p>
            <p>4. Save template</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailTemplateTest; 