"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/hooks/use-auth";
import { BookOpen, Clock, BarChart } from "lucide-react";

export default function ProfilePage() {
  const user = useUser();

  return (
    <div className="container px-4 py-6 space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Profile</h1>
        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user ? user.username : "John Doe"}</h2>
              <p className="text-muted-foreground">{user ? user.email : "john@example.com"}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="space-y-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h3 className="font-medium">Books Read</h3>
            <p className="text-2xl font-bold">24</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="space-y-2">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="font-medium">Reading Time</h3>
            <p className="text-2xl font-bold">127h</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="space-y-2">
            <BarChart className="h-5 w-5 text-primary" />
            <h3 className="font-medium">Daily Average</h3>
            <p className="text-2xl font-bold">2.5h</p>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-medium mb-2">Reading Progress</h3>
        <Progress value={75} className="h-2" />
        <p className="text-sm text-muted-foreground mt-2">75% of daily goal completed</p>
      </Card>
    </div>
  );
}