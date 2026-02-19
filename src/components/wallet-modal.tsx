'use client';

import { useState, useEffect } from 'react';
import { usePrivy, useWallets, useFundWallet, useSendTransaction } from '@privy-io/react-auth';
import { isAddress, encodeFunctionData, erc20Abi } from 'viem';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Send, Download, KeyRound, ExternalLink, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getExplorerUrl } from '@/lib/explorer';

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  balance: number;
  tokenSymbol: string;
}

export function WalletModal({ open, onOpenChange, address, balance, tokenSymbol }: WalletModalProps) {
  const { exportWallet } = usePrivy();
  const { wallets } = useWallets();
  const { fundWallet } = useFundWallet();
  const { sendTransaction } = useSendTransaction();

  // Clean up stale pointer-events on body when dialog closes.
  // Radix Dialog + DropdownMenu can leave body with pointer-events: none.
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = '';
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const [copied, setCopied] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const isValidRecipient = recipientAddress && isAddress(recipientAddress);
  const isValidAmount = sendAmount && parseFloat(sendAmount) > 0;
  const canSend = isValidRecipient && isValidAmount && !isSending;

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!canSend) return;

    const tokenAddress = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
    if (!tokenAddress) {
      setSendError('Token address not configured.');
      return;
    }

    setIsSending(true);
    setTxHash(null);
    setSendError(null);

    try {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [
          recipientAddress as `0x${string}`,
          BigInt(Math.floor(parseFloat(sendAmount) * 1e6)),
        ],
      });

      const receipt = await sendTransaction({
        to: tokenAddress as `0x${string}`,
        data,
      });

      if (receipt?.hash) {
        setTxHash(receipt.hash);
        setRecipientAddress('');
        setSendAmount('');
      }
    } catch (error) {
      console.error('Transaction failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed. Please try again.';
      setSendError(errorMessage.includes('User rejected') ? 'Transaction was cancelled.' : errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleExportKey = () => {
    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
    if (embeddedWallet) {
      exportWallet();
    } else {
      alert('Only Privy embedded wallets can be exported. Your external wallet is already self-custodied.');
    }
  };

  const shortenedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {address.slice(2, 4).toUpperCase()}
              </span>
            </div>
            My Wallet
          </DialogTitle>
        </DialogHeader>

        {/* Balance Display */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white">
          <p className="text-sm text-gray-400 mb-1">Total Balance</p>
          <p className="text-3xl font-bold">
            {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {tokenSymbol}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <code className="text-sm text-gray-400 font-mono">{shortenedAddress}</code>
            <button
              onClick={copyAddress}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Tabs for Send/Receive */}
        <Tabs defaultValue="receive" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="receive" className="gap-2">
              <Download className="h-4 w-4" />
              Receive
            </TabsTrigger>
            <TabsTrigger value="send" className="gap-2">
              <Send className="h-4 w-4" />
              Send
            </TabsTrigger>
          </TabsList>

          {/* Receive Tab */}
          <TabsContent value="receive" className="space-y-4 mt-4">
            <div className="text-center space-y-4">
              {/* QR Code */}
              <div className="mx-auto w-48 h-48 bg-white rounded-xl p-3 border border-gray-200 flex items-center justify-center shadow-sm">
                <QRCodeSVG
                  value={address}
                  size={168}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-600">Your wallet address</p>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-3">
                  <code className="flex-1 text-xs font-mono text-gray-700 break-all">
                    {address}
                  </code>
                  <button
                    onClick={copyAddress}
                    className="shrink-0 p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                onClick={() => fundWallet({ address })}
                className="w-full"
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                Buy / Fund Wallet
              </Button>
            </div>
          </TabsContent>

          {/* Send Tab */}
          <TabsContent value="send" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Address</Label>
                <Input
                  id="recipient"
                  placeholder="0x..."
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className={!recipientAddress || isValidRecipient ? '' : 'border-red-500'}
                />
                {recipientAddress && !isValidRecipient && (
                  <p className="text-xs text-red-500">Invalid address</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({tokenSymbol})</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                />
              </div>

              {txHash && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700 font-medium">Transaction sent!</p>
                  <a
                    href={getExplorerUrl('tx', txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 hover:underline flex items-center gap-1 mt-1"
                  >
                    View on Arbiscan
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {sendError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{sendError}</p>
                </div>
              )}

              <Button
                onClick={handleSend}
                disabled={!canSend}
                className="w-full"
              >
                {isSending ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Export Key Button */}
        <div className="border-t pt-4 mt-2">
          <Button
            onClick={handleExportKey}
            variant="ghost"
            className="w-full text-gray-600 hover:text-gray-900"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            Export Private Key
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
