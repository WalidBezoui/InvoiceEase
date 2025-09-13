
'use server';
/**
 * @fileOverview An AI agent for analyzing product transaction data and providing tips.
 *
 * - analyzeProductTransactions - A function that analyzes sales and stock data.
 * - getProductTip - A function that provides a short, actionable tip for a product.
 */

import { ai } from '@/ai/genkit';
import { ProductAnalysisInputSchema, ProductAnalysisOutputSchema, ProductTipInputSchema, ProductTipOutputSchema, type ProductAnalysisInput, type ProductAnalysisOutput, type ProductTipInput, type ProductTipOutput } from '@/lib/types';


export async function analyzeProductTransactions(input: ProductAnalysisInput): Promise<ProductAnalysisOutput> {
  return productAnalysisFlow(input);
}

export async function getProductTip(input: ProductTipInput): Promise<ProductTipOutput> {
    return productTipFlow(input);
}

const productAnalysisPrompt = ai.definePrompt({
  name: 'productAnalysisPrompt',
  input: { schema: ProductAnalysisInputSchema },
  output: { schema: ProductAnalysisOutputSchema },
  prompt: `
    You are an expert business analyst specializing in inventory management and sales strategy for small businesses.
    Your task is to analyze the provided data for a single product and give the user a clear, concise analysis and actionable suggestions in the requested language: {{language}}.

    Analyze the following product data (All prices are in {{{currency}}}):
    - Product Name: {{{productName}}}
    - Current Stock: {{{currentStock}}}
    - Standard Selling Price: {{{sellingPrice}}}
    - Standard Purchase Price: {{{purchasePrice}}}

    Transaction History (most recent first):
    {{#each transactions}}
    - Type: {{type}}, Quantity: {{quantityChange}}, Price: {{#if transactionPrice}}{{transactionPrice}}{{else}}N/A{{/if}}, Date: {{transactionDate}}
    {{/each}}

    Based on this data, perform the following in {{language}}:

    1.  **Analysis**: Write a short paragraph (3-4 sentences) summarizing the product's performance.
        - Calculate and comment on the sales velocity (how quickly the product sells).
        - Analyze stock trends. Is it decreasing rapidly? Is it stagnant?
        - If purchase and selling prices are available, comment on the product's profitability. Mention if recent sales prices differ from the standard selling price.

    2.  **Suggestions**: Provide a list of 2 to 4 clear, actionable suggestions.
        - If stock is low and sales are consistent, suggest reordering. Estimate when they might run out.
        - If the product is selling very well, suggest a potential price increase or promotion.
        - If sales are slow or stagnant, suggest a marketing push or a discount.
        - If purchase prices have been increasing, suggest reviewing the selling price to maintain margins.
        - Keep the suggestions practical and directly related to the provided data.

    Present your response in the specified JSON format. The language must be {{language}}.
  `,
});

const productAnalysisFlow = ai.defineFlow(
  {
    name: 'productAnalysisFlow',
    inputSchema: ProductAnalysisInputSchema,
    outputSchema: ProductAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await productAnalysisPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid analysis.");
    }
    return output;
  }
);


// Flow for the short product tip
const productTipPrompt = ai.definePrompt({
    name: 'productTipPrompt',
    input: { schema: ProductTipInputSchema },
    output: { schema: ProductTipOutputSchema },
    prompt: `
        You are an expert inventory management assistant. Your goal is to provide a very short, actionable tip (max 5 words) in the specified language: {{language}}.
        This tip will be displayed in a table cell to give a user a quick health check of the product.

        Analyze the provided data:
        - Current Stock Level: {{stockLevel}}
        - Recent Transaction History (most recent first):
        {{#each transactions}}
        - Type: {{type}}, Quantity Change: {{quantityChange}}, Date: {{transactionDate}}
        {{/each}}

        Use the following rules and expert examples to generate your response. You must determine the sales trend and stock status to create the most relevant tip.

        **1. Analyze Sales Trend from Transactions**
        - Count the number of 'sale' transactions in the last 7 days and the last 30 days.
        - 'Accelerating Sales': Sales in the last 7 days are disproportionately high compared to the 30-day average.
        - 'Slowing Sales': Sales in the last 7 days are disproportionately low.
        - 'Steady Sales': Sales are consistent.
        - 'No Recent Sales': No sales in the last 30 days.

        **2. Determine Stock Status**
        - 'Critically Low Stock': stock is 0-5.
        - 'Low Stock': stock is 6-20, especially if sales are steady or accelerating.
        - 'Healthy Stock': Stock level is appropriate for the sales velocity.
        - 'High Stock': Stock is very high compared to sales velocity (e.g., > 6 months of inventory).

        **3. Generate the Tip (Type and Text)**
        - Combine sales trend and stock status for an expert tip.
        - The tip MUST be very short and impactful.

        **EXPERT EXAMPLES (follow this logic)**

        **WARNINGS (Type: 'warning')**
        - If stock is 0: "Out of stock"
        - If stock is 1-5: "Critically low stock"
        - If sales are accelerating and stock is low: "Demand accelerating, reorder"
        - If stock > 0 but no sales in 30+ days: "Stagnant stock"
        - If stock is high and sales are slowing: "Slowing, high stock"
        
        **SUGGESTIONS (Type: 'suggestion')**
        - If sales are accelerating and stock is healthy: "Best-seller potential"
        - If sales are steady and stock is healthy: "Selling well"
        - If stock is very high and sales are low: "Consider promotion"
        - If sales are slowing but stock is healthy: "Monitor sales trend"

        **INFO (Type: 'info')**
        - If sales are steady and stock is healthy/high: "Steady sales"
        - If there are few transactions and stock is adequate: "Healthy stock level"
        - For new products with initial stock: "New product"

        Now, analyze the provided data and generate the expert response in {{language}}.
    `,
});

const productTipFlow = ai.defineFlow(
    {
        name: 'productTipFlow',
        inputSchema: ProductTipInputSchema,
        outputSchema: ProductTipOutputSchema,
    },
    async (input) => {
        const { output } = await productTipPrompt(input);
        if (!output) {
            throw new Error("The AI model did not return a valid tip.");
        }
        return output;
    }
);

    