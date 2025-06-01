"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { storage, db } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { UploadCloud, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

export default function LogoUploader() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingLogo, setIsLoadingLogo] = useState(true);


  useEffect(() => {
    async function fetchCurrentLogo() {
      if (user) {
        setIsLoadingLogo(true);
        const prefDocRef = doc(db, "userPreferences", user.uid);
        const docSnap = await getDoc(prefDocRef);
        if (docSnap.exists() && docSnap.data().logoUrl) {
          setCurrentLogoUrl(docSnap.data().logoUrl);
        }
        setIsLoadingLogo(false);
      }
    }
    fetchCurrentLogo();
  }, [user]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ title: "File too large", description: "Please select an image smaller than 2MB.", variant: "destructive" });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'].includes(selectedFile.type)) {
        toast({ title: "Invalid file type", description: "Please select a JPG, PNG, GIF or SVG image.", variant: "destructive" });
        return;
      }
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setIsUploading(true);
    try {
      // Delete old logo if exists from storage
      if (currentLogoUrl) {
        try {
          const oldLogoRef = ref(storage, currentLogoUrl);
          await deleteObject(oldLogoRef);
        } catch (deleteError: any) {
          // If old logo deletion fails (e.g. doesn't exist or permissions), log and continue.
          // This is not critical for uploading the new one.
          console.warn("Could not delete old logo, it might not exist:", deleteError.message);
        }
      }

      const storageRef = ref(storage, `logos/${user.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      const userPrefDocRef = doc(db, "userPreferences", user.uid);
      await updateDoc(userPrefDocRef, { logoUrl: downloadURL });
      
      setCurrentLogoUrl(downloadURL);
      setFile(null);
      setPreviewUrl(null);
      toast({ title: "Logo Uploaded", description: "Your company logo has been updated." });
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast({ title: "Upload Failed", description: "Could not upload your logo. Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!user || !currentLogoUrl) return;
    setIsDeleting(true);
    try {
      const logoRef = ref(storage, currentLogoUrl);
      await deleteObject(logoRef);
      
      const userPrefDocRef = doc(db, "userPreferences", user.uid);
      await updateDoc(userPrefDocRef, { logoUrl: null });

      setCurrentLogoUrl(null);
      toast({ title: "Logo Removed", description: "Your company logo has been removed." });
    } catch (error) {
      console.error("Error deleting logo:", error);
      toast({ title: "Deletion Failed", description: "Could not remove your logo. Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <Card className="bg-secondary/30">
      <CardHeader>
        <CardTitle className="font-headline text-lg text-primary">Company Logo</CardTitle>
        <CardDescription>Upload or change your company logo. Recommended size: 150x50px. Max 2MB.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="logo-upload" className="font-medium">Choose Logo File</Label>
          <Input id="logo-upload" type="file" accept="image/png, image/jpeg, image/gif, image/svg+xml" onChange={handleFileChange} className="file:text-primary file:font-medium"/>
        </div>

        {isLoadingLogo && (
           <div className="w-full h-32 flex items-center justify-center bg-muted rounded-md">
             <Loader2 className="h-8 w-8 text-primary animate-spin" />
           </div>
        )}

        {!isLoadingLogo && (previewUrl || currentLogoUrl) && (
          <div className="mt-4 p-4 border rounded-md bg-card flex flex-col items-center space-y-4">
            <p className="text-sm font-medium text-foreground">{previewUrl ? "New Logo Preview:" : "Current Logo:"}</p>
            <Image 
                src={previewUrl || currentLogoUrl || "https://placehold.co/150x50.png"} 
                alt="Company Logo" 
                width={150} 
                height={50} 
                className="object-contain rounded border"
                data-ai-hint="logo company"
            />
            {currentLogoUrl && !previewUrl && (
               <Button variant="destructive" onClick={handleDeleteLogo} disabled={isDeleting} size="sm">
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Remove Current Logo
              </Button>
            )}
          </div>
        )}
        
        {file && previewUrl && (
          <Button onClick={handleUpload} disabled={isUploading || !file} className="w-full md:w-auto">
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Upload New Logo
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
