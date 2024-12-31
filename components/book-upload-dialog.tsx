"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload, Image } from "lucide-react";

export function BookUploadDialog() {
  const [isPublic, setIsPublic] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Book
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload New Book</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Book Title</Label>
            <Input id="title" placeholder="Enter book title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Input id="author" placeholder="Enter author name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cover">Cover Image</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-secondary/50 transition-colors">
              <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to upload cover image
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="book">Book File (PDF)</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-secondary/50 transition-colors">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to upload PDF file
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="public">Make book public</Label>
            <Switch
              id="public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
        </div>
        <Button className="w-full">Upload Book</Button>
      </DialogContent>
    </Dialog>
  );
}