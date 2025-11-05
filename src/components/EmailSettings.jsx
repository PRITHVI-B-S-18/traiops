import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Bell, Clock, Calendar } from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const EmailSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    enabled: true,
    dailyReminders: true,
    weeklyReminders: true,
    scheduleNotifications: true,
    adminEmail: '',
    smtpSettings: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEmailSettings();
  }, []);

  const loadEmailSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'email'));
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data());
      }
    } catch (error) {
      console.error('Error loading email settings:', error);
    }
  };

  const saveEmailSettings = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'email'), settings);
      toast({
        title: 'Settings Saved',
        description: 'Email settings have been updated successfully.',
      });
    } catch (error) {
      console.error('Error saving email settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save email settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSmtpChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      smtpSettings: {
        ...prev.smtpSettings,
        [field]: value
      }
    }));
  };

  const testEmailConnection = async () => {
    setLoading(true);
    try {
      // This would typically call a Cloud Function to test the email connection
      toast({
        title: 'Test Email',
        description: 'Test email functionality would be implemented here.',
      });
    } catch (error) {
      toast({
        title: 'Test Failed',
        description: 'Failed to send test email. Please check your settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Mail className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Email Settings</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Configure which email notifications should be sent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => handleInputChange('enabled', checked)}
            />
            <Label htmlFor="enabled">Enable email notifications</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="scheduleNotifications"
              checked={settings.scheduleNotifications}
              onCheckedChange={(checked) => handleInputChange('scheduleNotifications', checked)}
            />
            <Label htmlFor="scheduleNotifications">Send notifications when schedules are created/updated/deleted</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="dailyReminders"
              checked={settings.dailyReminders}
              onCheckedChange={(checked) => handleInputChange('dailyReminders', checked)}
            />
            <Label htmlFor="dailyReminders">Send daily schedule reminders (8 AM)</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="weeklyReminders"
              checked={settings.weeklyReminders}
              onCheckedChange={(checked) => handleInputChange('weeklyReminders', checked)}
            />
            <Label htmlFor="weeklyReminders">Send weekly schedule summaries (Monday 9 AM)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            SMTP Configuration
          </CardTitle>
          <CardDescription>
            Configure your email server settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="smtpHost">SMTP Host</Label>
              <Input
                id="smtpHost"
                value={settings.smtpSettings.host}
                onChange={(e) => handleSmtpChange('host', e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <Label htmlFor="smtpPort">SMTP Port</Label>
              <Input
                id="smtpPort"
                type="number"
                value={settings.smtpSettings.port}
                onChange={(e) => handleSmtpChange('port', parseInt(e.target.value))}
                placeholder="587"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="adminEmail">Admin Email (for notifications)</Label>
            <Input
              id="adminEmail"
              type="email"
              value={settings.adminEmail}
              onChange={(e) => handleInputChange('adminEmail', e.target.value)}
              placeholder="admin@company.com"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="secure"
              checked={settings.smtpSettings.secure}
              onCheckedChange={(checked) => handleSmtpChange('secure', checked)}
            />
            <Label htmlFor="secure">Use secure connection (SSL/TLS)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Reminder Schedule
          </CardTitle>
          <CardDescription>
            Configure when reminders should be sent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
              <Calendar className="w-4 h-4 text-blue-600" />
              <div>
                <div className="font-medium">Daily Reminders</div>
                <div className="text-gray-600">Every day at 8:00 AM (IST)</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
              <Calendar className="w-4 h-4 text-green-600" />
              <div>
                <div className="font-medium">Weekly Summaries</div>
                <div className="text-gray-600">Every Monday at 9:00 AM (IST)</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button onClick={saveEmailSettings} disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button variant="outline" onClick={testEmailConnection} disabled={loading}>
          Test Email Connection
        </Button>
      </div>
    </div>
  );
};

export default EmailSettings; 