type Props = {
  message: string | null;
};

/** One-line pull failure hint under trip chrome. */
export function TripPullError({ message }: Props) {
  if (!message) return null;
  return (
    <p className="trip-pull-error" role="status">
      {message}
    </p>
  );
}
