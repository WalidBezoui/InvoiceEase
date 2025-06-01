
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase"; // Removed storage import
import { doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { UploadCloud, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const MAX_FILE_SIZE_KB = 200; // Max file size in Kilobytes for Data URI storage
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_KB * 1024;

export default function LogoUploader() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [currentLogoDataUrl, setCurrentLogoDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // Combined uploading/deleting state
  const [isLoadingLogo, setIsLoadingLogo] = useState(true);


  useEffect(() => {
    async function fetchCurrentLogo() {
      if (user) {
        setIsLoadingLogo(true);
        try {
          const prefDocRef = doc(db, "userPreferences", user.uid);
          const docSnap = await getDoc(prefDocRef);
          if (docSnap.exists() && docSnap.data().logoDataUrl) {
            setCurrentLogoDataUrl(docSnap.data().logoDataUrl);
          } else {
            setCurrentLogoDataUrl(null);
          }
        } catch (error) {
          console.error("Error fetching current logo:", error);
          toast({
            title: "Error fetching logo",
            description: "Could not load your current company logo.",
            variant: "destructive",
          });
          setCurrentLogoDataUrl(null);
        } finally {
          setIsLoadingLogo(false);
        }
      } else {
        setCurrentLogoDataUrl(null);
        setIsLoadingLogo(false);
      }
    }
    fetchCurrentLogo();
  }, [user, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File too large", description: `Please select an image smaller than ${MAX_FILE_SIZE_KB}KB.`, variant: "destructive" });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'].includes(selectedFile.type)) {
        toast({ title: "Invalid file type", description: "Please select a JPG, PNG, GIF or SVG image.", variant: "destructive" });
        return;
      }
      setFile(selectedFile);
      
      // Convert to Data URI for preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewDataUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSaveLogo = async () => {
    if (!file || !user || !previewDataUrl) return;
    setIsProcessing(true);
    try {
      const userPrefDocRef = doc(db, "userPreferences", user.uid);
      // Use setDoc with merge: true to create the document if it doesn't exist, or update it if it does.
      await setDoc(userPrefDocRef, { logoDataUrl: previewDataUrl }, { merge: true });
      
      setCurrentLogoDataUrl(previewDataUrl);
      setFile(null);
      setPreviewDataUrl(null); // Clear preview after successful save
      toast({ title: "Logo Saved", description: "Your company logo has been updated." });
    } catch (error) {
      console.error("Error saving logo:", error);
      toast({ title: "Save Failed", description: "Could not save your logo. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!user || !currentLogoDataUrl) return; // Check currentLogoDataUrl to ensure there's something to delete
    setIsProcessing(true);
    try {
      const userPrefDocRef = doc(db, "userPreferences", user.uid);
      await updateDoc(userPrefDocRef, { logoDataUrl: null }); // Set to null or delete field

      setCurrentLogoDataUrl(null);
      setFile(null); // Also clear any pending file selection
      setPreviewDataUrl(null); // Clear preview
      toast({ title: "Logo Removed", description: "Your company logo has been removed." });
    } catch (error) {
      console.error("Error deleting logo:", error);
      toast({ title: "Deletion Failed", description: "Could not remove your logo. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <Card className="bg-secondary/30">
      <CardHeader>
        <CardTitle className="font-headline text-lg text-primary">Company Logo</CardTitle>
        <CardDescription>Upload or change your company logo. Max {MAX_FILE_SIZE_KB}KB. Stored directly in database.</CardDescription>
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

        {!isLoadingLogo && (previewDataUrl || currentLogoDataUrl) && (
          <div className="mt-4 p-4 border rounded-md bg-card flex flex-col items-center space-y-4">
            <p className="text-sm font-medium text-foreground">{previewDataUrl ? "New Logo Preview:" : "Current Logo:"}</p>
            <Image 
                src={previewDataUrl || currentLogoDataUrl || "https://placehold.co/150x50.png"} 
                alt="Company Logo" 
                width={150} 
                height={50} 
                className="object-contain rounded border"
                data-ai-hint="logo company"
            />
            {currentLogoDataUrl && !previewDataUrl && ( // Show remove only if there's a current logo and no new preview
               <Button variant="destructive" onClick={handleDeleteLogo} disabled={isProcessing} size="sm">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Remove Current Logo
              </Button>
            )}
          </div>
        )}
        
        {file && previewDataUrl && ( // Show save button if a file is selected and preview is generated
          <Button onClick={handleSaveLogo} disabled={isProcessing || !file} className="w-full md:w-auto">
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Save New Logo
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
