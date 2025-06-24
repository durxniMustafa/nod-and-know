import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HelpDialog: React.FC<HelpDialogProps> = ({ open, onOpenChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="bg-gray-900 border-gray-700 text-gray-200">
      <DialogHeader>
        <DialogTitle>How to Participate</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-2 text-left mt-2">
            <p>• Allow camera access when prompted.</p>
            <p>• Nod for <span className="font-semibold">YES</span> and shake for <span className="font-semibold">NO</span>.</p>
            <p>• Each person can vote once per question.</p>
            <p>• When matched with someone who disagrees, a chat will open so you can discuss.</p>
          </div>
        </DialogDescription>
      </DialogHeader>
      <DialogClose asChild>
        <Button className="mt-4 w-full">Got it!</Button>
      </DialogClose>
    </DialogContent>
  </Dialog>
);

export default HelpDialog;
