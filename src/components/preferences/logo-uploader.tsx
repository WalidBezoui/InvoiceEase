
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { UploadCloud, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useLanguage } from "@/hooks/use-language"; // Import useLanguage

const MAX_FILE_SIZE_KB = 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_KB * 1024;

export default function LogoUploader() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, isLoadingLocale } = useLanguage(); // Use language hook
  const [file, setFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [currentLogoDataUrl, setCurrentLogoDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
            title: t('preferencesPage.logoUploader.toast.errorFetchingLogo'),
            description: t('preferencesPage.logoUploader.toast.errorFetchingLogoDesc'),
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
  }, [user, toast, t]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: t('preferencesPage.logoUploader.toast.fileTooLarge'), description: t('preferencesPage.logoUploader.toast.fileTooLargeDesc', {maxSize: MAX_FILE_SIZE_KB}), variant: "destructive" });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'].includes(selectedFile.type)) {
        toast({ title: t('preferencesPage.logoUploader.toast.invalidFileType'), description: t('preferencesPage.logoUploader.toast.invalidFileTypeDesc'), variant: "destructive" });
        return;
      }
      setFile(selectedFile);
      
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
      await setDoc(userPrefDocRef, { logoDataUrl: previewDataUrl }, { merge: true });
      
      setCurrentLogoDataUrl(previewDataUrl);
      setFile(null);
      setPreviewDataUrl(null);
      toast({ title: t('preferencesPage.logoUploader.toast.logoSaved'), description: t('preferencesPage.logoUploader.toast.logoSavedDesc') });
    } catch (error) {
      console.error("Error saving logo:", error);
      toast({ title: t('preferencesPage.logoUploader.toast.saveFailed'), description: t('preferencesPage.logoUploader.toast.saveFailedDesc'), variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!user || !currentLogoDataUrl) return;
    setIsProcessing(true);
    try {
      const userPrefDocRef = doc(db, "userPreferences", user.uid);
      await updateDoc(userPrefDocRef, { logoDataUrl: null }); 

      setCurrentLogoDataUrl(null);
      setFile(null); 
      setPreviewDataUrl(null);
      toast({ title: t('preferencesPage.logoUploader.toast.logoRemoved'), description: t('preferencesPage.logoUploader.toast.logoRemovedDesc') });
    } catch (error) {
      console.error("Error deleting logo:", error);
      toast({ title: t('preferencesPage.logoUploader.toast.deletionFailed'), description: t('preferencesPage.logoUploader.toast.deletionFailedDesc'), variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (isLoadingLocale) {
    return <Card className="bg-secondary/30"><CardHeader><CardTitle>Loading...</CardTitle></CardHeader></Card>; // Basic loader
  }

  return (
    <Card className="bg-secondary/30">
      <CardHeader>
        <CardTitle className="font-headline text-lg text-primary">{t('preferencesPage.logoUploader.cardTitle')}</CardTitle>
        <CardDescription>{t('preferencesPage.logoUploader.cardDescription', {maxSize: MAX_FILE_SIZE_KB})}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="logo-upload" className="font-medium">{t('preferencesPage.logoUploader.chooseFile')}</Label>
          <Input id="logo-upload" type="file" accept="image/png, image/jpeg, image/gif, image/svg+xml" onChange={handleFileChange} className="file:text-primary file:font-medium"/>
        </div>

        {isLoadingLogo && (
           <div className="w-full h-32 flex items-center justify-center bg-muted rounded-md">
             <Loader2 className="h-8 w-8 text-primary animate-spin" />
           </div>
        )}

        {!isLoadingLogo && (previewDataUrl || currentLogoDataUrl) && (
          <div className="mt-4 p-4 border rounded-md bg-card flex flex-col items-center space-y-4">
            <p className="text-sm font-medium text-foreground">{previewDataUrl ? t('preferencesPage.logoUploader.newLogoPreview') : t('preferencesPage.logoUploader.currentLogo')}</p>
            <Image 
                src={previewDataUrl || currentLogoDataUrl || "https://placehold.co/150x50.png"} 
                alt="Company Logo" 
                width={150} 
                height={50} 
                className="object-contain rounded border"
                data-ai-hint="logo company"
            />
            {currentLogoDataUrl && !previewDataUrl && (
               <Button variant="destructive" onClick={handleDeleteLogo} disabled={isProcessing} size="sm">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {t('preferencesPage.logoUploader.removeCurrentLogo')}
              </Button>
            )}
          </div>
        )}
        
        {file && previewDataUrl && (
          <Button onClick={handleSaveLogo} disabled={isProcessing || !file} className="w-full md:w-auto">
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {t('preferencesPage.logoUploader.saveNewLogo')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

      