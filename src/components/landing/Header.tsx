export const Header = () => {
    return (
        <div className="text-center mb-8 md:mb-12">
            <div className="mb-6 flex justify-center">
                <img
                    src="/logo.svg"
                    alt="PonsLink"
                    className="h-12 w-auto md:h-14 drop-shadow-[0_12px_32px_rgba(99,102,241,0.18)]"
                />
            </div>
            <p className="text-muted-foreground text-sm md:text-lg px-4">
            Requests, approval, and live sessions in one personal link.
            </p>
        </div>
    );
}
