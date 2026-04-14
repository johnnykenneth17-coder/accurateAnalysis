const Tip = require("../models/Tip");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("join-tips-room", () => {
      socket.join("tips-room");
      console.log(`Socket ${socket.id} joined tips-room`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Function to emit tip updates to all clients in tips-room
  const emitTipUpdate = async (tipId) => {
    const tip = await Tip.findById(tipId);
    if (tip) {
      io.to("tips-room").emit("tip-updated", tip);
      console.log(`Tip ${tipId} update emitted to tips-room`);
    }
  };

  return { emitTipUpdate };
};
