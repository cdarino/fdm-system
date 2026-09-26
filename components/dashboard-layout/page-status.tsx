export function PageError({ message }: { message: string }) {
  return (
    <div role="alert" className="py-12 text-center">
      <p className="font-medium text-destructive">{message}</p>
    </div>
  );
}

