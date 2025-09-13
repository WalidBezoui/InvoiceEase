
"use client";

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Loader2, AlertTriangle, BarChart as BarChartIcon } from 'lucide-react';
import type { Product, ProductTransaction, ProductAnalysisOutput, UserPreferences } from '@/lib/types';
import { analyzeProductTransactions } from '@/ai/flows/product-analysis-flow';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface ProductAnalysisProps {
  product: Product;
  transactions: ProductTransaction[];
  userPrefs: UserPreferences | null;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

export default function ProductAnalysis({ product, transactions, userPrefs, t }: ProductAnalysisProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<ProductAnalysisOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        // We only need a subset of the transaction data for the AI
        const transactionSummary = transactions.map(tx => ({
            type: tx.type,
            quantityChange: tx.quantityChange,
            transactionDate: tx.transactionDate.toDate().toISOString(),
            transactionPrice: tx.transactionPrice
        })).slice(0, 50); // Limit to the 50 most recent transactions to avoid oversized payloads

        try {
            const result = await analyzeProductTransactions({
                productName: product.name,
                sellingPrice: product.sellingPrice,
                purchasePrice: product.purchasePrice,
                currentStock: product.stock,
                currency: userPrefs?.currency || 'MAD',
                transactions: transactionSummary
            });
            setAnalysisResult(result);
        } catch (err) {
            console.error(err);
            setError(t('productDetailPage.analysis.error'));
        } finally {
            setIsLoading(false);
        }
    };
    
    const chartData = useMemo(() => {
        return transactions
            .map(tx => ({
                date: format(tx.transactionDate.toDate(), 'yyyy-MM-dd'),
                stock: tx.newStock,
            }))
            .reverse(); // Reverse to show chronological order
    }, [transactions]);


    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-xl text-primary flex items-center">
                    <BarChartIcon className="mr-2" /> {t('productDetailPage.analysis.cardTitle')}
                </CardTitle>
                <CardDescription>
                    {t('productDetailPage.analysis.cardDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                
                <div>
                  <h3 className="font-semibold text-lg mb-2">{t('productDetailPage.analysis.stockChartTitle')}</h3>
                   {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false}/>
                                <YAxis fontSize={12} tickLine={false} axisLine={false}/>
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                                <Legend />
                                <Bar dataKey="stock" fill="hsl(var(--primary))" name={t('productDetailPage.currentStock')} />
                            </BarChart>
                        </ResponsiveContainer>
                   ) : (
                       <p className="text-muted-foreground text-sm text-center py-4">{t('productDetailPage.analysis.noChartData')}</p>
                   )}
                </div>

                <div className="text-center">
                    <Button onClick={handleAnalyze} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                        {t('productDetailPage.analysis.generateButton')}
                    </Button>
                </div>
                
                {isLoading && (
                    <div className="flex justify-center items-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="ml-2 text-muted-foreground">{t('productDetailPage.analysis.loading')}</p>
                    </div>
                )}
                
                {error && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm flex items-center">
                        <AlertTriangle className="mr-2 h-4 w-4"/>
                        {error}
                    </div>
                )}

                {analysisResult && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold text-lg text-primary">{t('productDetailPage.analysis.analysisTitle')}</h3>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysisResult.analysis}</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-primary">{t('productDetailPage.analysis.suggestionsTitle')}</h3>
                             <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                                {analysisResult.suggestions.map((suggestion, index) => (
                                    <li key={index}>{suggestion}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

            </CardContent>
        </Card>
    );
}
